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

    // Get the project and its fields
    // Note: GitHub Project IDs need to be in the format: PVT_kwDO... or O_kgDO...
    // The projectId in the database should be the numeric ID, but we need the full node ID
    // For now, we'll try to construct it, but users may need to provide the full node ID
    const projectNodeId = `PVT_kwDOQx2LLM${projectId}`; // This is a placeholder format

    const projectQuery = `
      query GetProject($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
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
      const projectData: any = await githubClient.graphql(projectQuery, {
        projectId: projectNodeId,
      });
      project = projectData.node;
    } catch (error) {
      // If the constructed ID doesn't work, try using the numeric ID directly
      // Some projects might use a different format
      console.warn(
        `Failed to fetch project with ID ${projectNodeId}, trying alternative format`
      );
      try {
        const projectData: any = await githubClient.graphql(projectQuery, {
          projectId: `O_kgDO${projectId}`, // Alternative format for organization projects
        });
        project = projectData.node;
      } catch (error2) {
        console.error("Failed to fetch GitHub Project:", error2);
        throw new Error(
          `Project ${projectId} not found. Make sure the project ID is correct and the project exists.`
        );
      }
    }

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Find the status field (usually named "Status")
    const statusField = project.fields.nodes.find(
      (field: any) => field.name === "Status" && field.options
    );

    if (!statusField) {
      console.warn(
        "Status field not found in project. Project sync will skip status updates."
      );
      // Still try to add the issue to the project even without status field
    }

    // Find if issue is already in project
    const itemsQuery = `
      query GetProjectItems($projectId: ID!, $issueId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100, filter: { content: { id: $issueId } }) {
              nodes {
                id
              }
            }
          }
        }
      }
    `;

    const itemsData: any = await githubClient.graphql(itemsQuery, {
      projectId: project.id,
      issueId: issueNodeId,
    });

    const existingItem = itemsData.node?.items?.nodes?.[0];

    if (existingItem && statusField) {
      // Update existing project item status
      const statusOption = statusField.options.find(
        (opt: any) => opt.name === statusValue
      );

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

        console.log(`✅ Updated project item status to "${statusValue}"`);
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
        const statusOption = statusField.options.find(
          (opt: any) => opt.name === statusValue
        );

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
