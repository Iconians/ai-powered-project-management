import { IntegrationProvider } from "@prisma/client";

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
}

export interface SlackNotification {
  text: string;
  title?: string;
  link?: string;
  color?: "good" | "warning" | "danger";
}

export async function sendSlackNotification(
  config: SlackConfig,
  notification: SlackNotification
): Promise<boolean> {
  try {
    const payload = {
      text: notification.text,
      username: config.username || "Project Management",
      channel: config.channel,
      attachments: notification.title
        ? [
            {
              color: notification.color || "good",
              title: notification.title,
              text: notification.text,
              title_link: notification.link,
            },
          ]
        : [],
    };

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
    return false;
  }
}

export async function validateSlackConfig(config: SlackConfig): Promise<boolean> {
  if (!config.webhookUrl || !config.webhookUrl.startsWith("https://hooks.slack.com/")) {
    return false;
  }
  return true;
}
