import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import { TaskStatus } from "@prisma/client";

// Type definitions for GitHub GraphQL API responses
interface GitHubIssueResponse {
  repository: {
    issue: {
      id: string;
    } | null;
  } | null;
}

interface GitHubProjectField {
  id: string;
  name: string;
}

interface GitHubProjectSingleSelectFieldOption {
  id: string;
  name: string;
}

interface GitHubProjectSingleSelectField extends GitHubProjectField {
  options: GitHubProjectSingleSelectFieldOption[];
}

type GitHubProjectFieldNode =
  | GitHubProjectField
  | GitHubProjectSingleSelectField;

interface GitHubProject {
  id: string;
  title: string;
  fields: {
    nodes: GitHubProjectFieldNode[];
  };
}

interface GitHubUserProjectResponse {
  user: {
    projectV2: GitHubProject | null;
  } | null;
}

interface GitHubOrgProjectResponse {
  organization: {
    projectV2: GitHubProject | null;
  } | null;
}

interface GitHubProjectItem {
  id: string;
  content: {
    id: string;
    number?: number;
  } | null;
}

interface GitHubProjectItemsResponse {
  node: {
    items: {
      nodes: GitHubProjectItem[];
    };
  } | null;
}

interface GitHubAddItemResponse {
  addProjectV2ItemById: {
    item: {
      id: string;
    } | null;
  } | null;
}

interface GitHubGraphQLError {
  errors?: Array<{
    message: string;
  }>;
  message?: string;
}

// Sync task to GitHub Project (using GraphQL API v2)
export async function syncTaskToGitHubProject(
  githubClient: { rest: Octokit; graphql: typeof graphql },
  issueNumber: number,
  projectId: number,
  taskStatus: TaskStatus,
  repoName: string
) {
  try {
    // Map task status to project field value
    const statusMap: Record<TaskStatus, string> = {
      TODO: "Todo",
      IN_PROGRESS: "In Progress",
      IN_REVIEW: "In Review",
      DONE: "Done",
      BLOCKED: "Blocked",
    };
    const statusValue = statusMap[taskStatus] || "Todo";

    const [owner, repo] = repoName.split("/");

    // First, get the issue node ID
    const issueQuery = `
      query GetIssue($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
          }
        }
      }
    `;

    const issueData = await githubClient.graphql<GitHubIssueResponse>(
      issueQuery,
      {
        owner,
        repo,
        number: issueNumber,
      }
    );

    if (!issueData.repository?.issue?.id) {
      console.warn(`Issue #${issueNumber} not found in ${repoName}`);
      return;
    }

    const issueNodeId = issueData.repository.issue.id;

    // Get the project using owner and project number
    // This works for both user and organization projects
    // First, try as a user project, then as an organization project
    const userProjectQuery = `
      query GetUserProject($login: String!, $number: Int!) {
        user(login: $login) {
          projectV2(number: $number) {
            id
            title
            fields(first: 20) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const orgProjectQuery = `
      query GetOrgProject($login: String!, $number: Int!) {
        organization(login: $login) {
          projectV2(number: $number) {
            id
            title
            fields(first: 20) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    let project: GitHubProject | null = null;
    try {
      // Try user project first
      const userProjectData =
        await githubClient.graphql<GitHubUserProjectResponse>(
          userProjectQuery,
          {
            login: owner,
            number: projectId,
          }
        );
      project = userProjectData.user?.projectV2 ?? null;

      // If not found, try organization project
      if (!project) {
        const orgProjectData =
          await githubClient.graphql<GitHubOrgProjectResponse>(
            orgProjectQuery,
            {
              login: owner,
              number: projectId,
            }
          );
        project = orgProjectData.organization?.projectV2 ?? null;
      }
    } catch (error) {
      console.error("Failed to fetch GitHub Project:", error);
      const graphqlError = error as GitHubGraphQLError;
      const errorMessage =
        graphqlError?.errors?.[0]?.message ||
        graphqlError?.message ||
        "Unknown error";
      if (errorMessage.includes("read:project")) {
        throw new Error(
          `Missing required GitHub scope: read:project. Please reconnect your GitHub account to grant project access.`
        );
      }
      throw new Error(
        `Project ${projectId} not found for ${owner}. Make sure the project ID is correct and the project exists. Error: ${errorMessage}`
      );
    }

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Find the status field (usually named "Status")
    // Try exact match first, then case-insensitive
    let statusField = project.fields.nodes.find(
      (field): field is GitHubProjectSingleSelectField =>
        field.name === "Status" &&
        "options" in field &&
        field.options !== undefined
    ) as GitHubProjectSingleSelectField | undefined;

    if (!statusField) {
      statusField = project.fields.nodes.find(
        (field): field is GitHubProjectSingleSelectField =>
          field.name?.toLowerCase() === "status" &&
          "options" in field &&
          field.options !== undefined
      ) as GitHubProjectSingleSelectField | undefined;
    }

    if (!statusField) {
      console.warn(
        `Status field not found in project. Available fields: ${project.fields.nodes
          .map((f) => f.name)
          .join(", ")}`
      );
      // Still try to add the issue to the project even without status field
    } else {
      console.log(
        `✅ Found status field: "${
          statusField.name
        }" with options: ${statusField.options
          .map((opt) => opt.name)
          .join(", ")}`
      );
    }

    // Find if issue is already in project
    // Query all items and check if any match our issue
    const itemsQuery = `
      query GetProjectItems($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    id
                    number
                  }
                }
              }
            }
          }
        }
      }
    `;

    const itemsData = await githubClient.graphql<GitHubProjectItemsResponse>(
      itemsQuery,
      {
        projectId: project.id,
      }
    );

    // Find the item that matches our issue
    const existingItem = itemsData.node?.items?.nodes?.find(
      (item) => item.content?.id === issueNodeId
    );

    if (existingItem && statusField) {
      // Update existing project item status
      // Try exact match first, then case-insensitive
      let statusOption = statusField.options.find(
        (opt) => opt.name === statusValue
      );

      if (!statusOption) {
        statusOption = statusField.options.find(
          (opt) => opt.name?.toLowerCase() === statusValue.toLowerCase()
        );
      }

      if (statusOption) {
        const updateItemMutation = `
          mutation UpdateProjectItem($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
            updateProjectV2ItemFieldValue(
              input: {
                projectId: $projectId
                itemId: $itemId
                fieldId: $fieldId
                value: { singleSelectOptionId: $optionId }
              }
            ) {
              projectV2Item {
                id
              }
            }
          }
        `;

        await githubClient.graphql(updateItemMutation, {
          projectId: project.id,
          itemId: existingItem.id,
          fieldId: statusField.id,
          optionId: statusOption.id,
        });

        console.log(
          `✅ Updated project item status to "${statusValue}" (matched option: "${statusOption.name}")`
        );
      } else {
        console.warn(
          `⚠️ Status option "${statusValue}" not found in project. Available options: ${statusField.options
            .map((opt) => opt.name)
            .join(", ")}`
        );
      }
    } else if (!existingItem) {
      // Add issue to project
      const addItemMutation = `
        mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
          addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
            item {
              id
            }
          }
        }
      `;

      const addResult = await githubClient.graphql<GitHubAddItemResponse>(
        addItemMutation,
        {
          projectId: project.id,
          contentId: issueNodeId,
        }
      );

      if (addResult.addProjectV2ItemById?.item?.id && statusField) {
        // Update the status after adding
        // Try exact match first, then case-insensitive
        let statusOption = statusField.options.find(
          (opt) => opt.name === statusValue
        );

        if (!statusOption) {
          statusOption = statusField.options.find(
            (opt) => opt.name?.toLowerCase() === statusValue.toLowerCase()
          );
        }

        if (statusOption) {
          await githubClient.graphql(
            `
              mutation UpdateProjectItem($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
                updateProjectV2ItemFieldValue(
                  input: {
                    projectId: $projectId
                    itemId: $itemId
                    fieldId: $fieldId
                    value: { singleSelectOptionId: $optionId }
                  }
                ) {
                  projectV2Item {
                    id
                  }
                }
              }
            `,
            {
              projectId: project.id,
              itemId: addResult.addProjectV2ItemById.item.id,
              fieldId: statusField.id,
              optionId: statusOption.id,
            }
          );

          // Also update the issue label to match the project status
          try {
            const statusLabel =
              statusValue === "Todo"
                ? "todo"
                : statusValue === "In Progress"
                ? "in-progress"
                : statusValue === "In Review"
                ? "in-review"
                : statusValue === "Done"
                ? "done"
                : statusValue === "Blocked"
                ? "blocked"
                : "todo";

            const [owner, repo] = repoName.split("/");

            // Get current labels
            const { data: currentIssue } = await githubClient.rest.issues.get({
              owner,
              repo,
              issue_number: issueNumber,
            });

            const currentLabels =
              currentIssue.labels
                ?.map((l) => (typeof l === "string" ? l : l.name))
                .filter((l): l is string => typeof l === "string") || [];
            const statusLabels = [
              "todo",
              "in-progress",
              "in-review",
              "done",
              "blocked",
            ];
            const labelsToRemove = currentLabels.filter((l) =>
              statusLabels.includes(l.toLowerCase())
            );

            // Remove old status labels
            for (const label of labelsToRemove) {
              if (label.toLowerCase() !== statusLabel) {
                try {
                  await githubClient.rest.issues.removeLabel({
                    owner,
                    repo,
                    issue_number: issueNumber,
                    name: label,
                  });
                } catch {
                  // Label might not exist, continue
                }
              }
            }

            // Add new status label
            if (!currentLabels.some((l) => l.toLowerCase() === statusLabel)) {
              try {
                await githubClient.rest.issues.addLabels({
                  owner,
                  repo,
                  issue_number: issueNumber,
                  labels: [statusLabel],
                });
                console.log(
                  `✅ Updated issue label to "${statusLabel}" to match project status`
                );
              } catch {
                // Try creating the label if it doesn't exist
                try {
                  await githubClient.rest.issues.createLabel({
                    owner,
                    repo,
                    name: statusLabel,
                    color: "0e8a16",
                  });
                  await githubClient.rest.issues.addLabels({
                    owner,
                    repo,
                    issue_number: issueNumber,
                    labels: [statusLabel],
                  });
                } catch (createError) {
                  console.error("Failed to create/add label:", createError);
                }
              }
            }
          } catch (labelError) {
            console.error("Failed to update issue label:", labelError);
            // Don't fail the whole sync if label update fails
          }
        }

        console.log(
          `✅ Added issue #${issueNumber} to project and set status to "${statusValue}"`
        );
      } else {
      }
    }
  } catch (error) {
    console.error("Failed to sync to GitHub Project:", error);
    throw error;
  }
}
