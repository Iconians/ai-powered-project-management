import { IntegrationProvider } from "@prisma/client";

export interface JiraConfig {
  baseUrl: string; // e.g., https://yourcompany.atlassian.net
  apiToken: string;
  email: string;
  projectKey: string;
}

export interface JiraIssue {
  summary: string;
  description?: string;
  issueType: string; // "Task", "Bug", "Story", etc.
  priority?: string;
  assignee?: string;
}

export async function createJiraIssue(
  config: JiraConfig,
  issue: JiraIssue
): Promise<{ id: string; key: string } | null> {
  try {
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");

    const payload = {
      fields: {
        project: {
          key: config.projectKey,
        },
        summary: issue.summary,
        description: issue.description || "",
        issuetype: {
          name: issue.issueType,
        },
        ...(issue.priority && {
          priority: {
            name: issue.priority,
          },
        }),
        ...(issue.assignee && {
          assignee: {
            accountId: issue.assignee,
          },
        }),
      },
    };

    const response = await fetch(`${config.baseUrl}/rest/api/3/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to create Jira issue:", error);
      return null;
    }

    const data = await response.json();
    return { id: data.id, key: data.key };
  } catch (error) {
    console.error("Failed to create Jira issue:", error);
    return null;
  }
}

export async function validateJiraConfig(config: JiraConfig): Promise<boolean> {
  try {
    if (!config.baseUrl || !config.apiToken || !config.email || !config.projectKey) {
      return false;
    }

    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
    const response = await fetch(`${config.baseUrl}/rest/api/3/myself`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}
