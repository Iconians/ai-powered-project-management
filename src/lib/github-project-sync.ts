import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import { TaskStatus } from "@prisma/client";

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

    const issueData: any = await githubClient.graphql(issueQuery, {
      owner,
      repo,
      number: issueNumber,
    });

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

    let project;
    try {
      // Try user project first
      const userProjectData: any = await githubClient.graphql(
        userProjectQuery,
        {
          login: owner,
          number: projectId,
        }
      );
      project = userProjectData.user?.projectV2;

      // If not found, try organization project
      if (!project) {
        const orgProjectData: any = await githubClient.graphql(
          orgProjectQuery,
          {
            login: owner,
            number: projectId,
          }
        );
        project = orgProjectData.organization?.projectV2;
      }
    } catch (error: any) {
      console.error("Failed to fetch GitHub Project:", error);
      const errorMessage = error?.errors?.[0]?.message || error.message;
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
      (field: any) => field.name === "Status" && field.options
    );

    if (!statusField) {
      statusField = project.fields.nodes.find(
        (field: any) => field.name?.toLowerCase() === "status" && field.options
      );
    }

    if (!statusField) {
      console.warn(
        `Status field not found in project. Available fields: ${project.fields.nodes
          .map((f: any) => f.name)
          .join(", ")}`
      );
      // Still try to add the issue to the project even without status field
    } else {
      console.log(
        `✅ Found status field: "${
          statusField.name
        }" with options: ${statusField.options
          .map((opt: any) => opt.name)
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

    const itemsData: any = await githubClient.graphql(itemsQuery, {
      projectId: project.id,
    });

    // Find the item that matches our issue
    const existingItem = itemsData.node?.items?.nodes?.find(
      (item: any) => item.content?.id === issueNodeId
    );

    if (existingItem && statusField) {
      // Update existing project item status
      // Try exact match first, then case-insensitive
      let statusOption = statusField.options.find(
        (opt: any) => opt.name === statusValue
      );

      if (!statusOption) {
        statusOption = statusField.options.find(
          (opt: any) => opt.name?.toLowerCase() === statusValue.toLowerCase()
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
            .map((opt: any) => opt.name)
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

      const addResult: any = await githubClient.graphql(addItemMutation, {
        projectId: project.id,
        contentId: issueNodeId,
      });

      if (addResult.addProjectV2ItemById?.item?.id && statusField) {
        // Update the status after adding
        // Try exact match first, then case-insensitive
        let statusOption = statusField.options.find(
          (opt: any) => opt.name === statusValue
        );

        if (!statusOption) {
          statusOption = statusField.options.find(
            (opt: any) => opt.name?.toLowerCase() === statusValue.toLowerCase()
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
              currentIssue.labels?.map((l: any) => l.name) || [];
            const statusLabels = [
              "todo",
              "in-progress",
              "in-review",
              "done",
              "blocked",
            ];
            const labelsToRemove = currentLabels.filter((l: string) =>
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
                } catch (error) {
                  // Label might not exist, continue
                }
              }
            }

            // Add new status label
            if (
              !currentLabels.some(
                (l: string) => l.toLowerCase() === statusLabel
              )
            ) {
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
              } catch (error) {
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
                  console.log(`✅ Created and added label "${statusLabel}"`);
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
        console.log(`✅ Added issue #${issueNumber} to project`);
      }
    }
  } catch (error) {
    console.error("Failed to sync to GitHub Project:", error);
    throw error;
  }
}
