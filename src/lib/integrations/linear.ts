export interface LinearConfig {
  apiKey: string;
  teamId: string;
}

export interface LinearIssue {
  title: string;
  description?: string;
  priority?: number; // 0-4 (0 = No priority, 4 = Urgent)
  assigneeId?: string;
  stateId?: string;
}

export async function createLinearIssue(
  config: LinearConfig,
  issue: LinearIssue
): Promise<{ id: string } | null> {
  try {
    const mutation = `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
          }
        }
      }
    `;

    const variables = {
      input: {
        teamId: config.teamId,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        assigneeId: issue.assigneeId,
        stateId: issue.stateId,
      },
    };

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: config.apiKey,
      },
      body: JSON.stringify({
        query: mutation,
        variables,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to create Linear issue:", error);
      return null;
    }

    const data = await response.json();
    if (data.errors || !data.data?.issueCreate?.success) {
      console.error("Linear API error:", data.errors || data.data);
      return null;
    }

    return { id: data.data.issueCreate.issue.id };
  } catch (error) {
    console.error("Failed to create Linear issue:", error);
    return null;
  }
}

export async function validateLinearConfig(config: LinearConfig): Promise<boolean> {
  try {
    if (!config.apiKey || !config.teamId) {
      return false;
    }

    const query = `
      query {
        viewer {
          id
        }
      }
    `;

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: config.apiKey,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return !data.errors && !!data.data?.viewer;
  } catch (error) {
    return false;
  }
}
