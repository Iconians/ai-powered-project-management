export interface ZapierConfig {
  webhookUrl: string;
}

export interface ZapierWebhookPayload {
  event: string;
  data: {
    taskId?: string;
    boardId?: string;
    organizationId?: string;
    [key: string]: any;
  };
}

export async function sendZapierWebhook(
  config: ZapierConfig,
  payload: ZapierWebhookPayload
): Promise<boolean> {
  try {
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to send Zapier webhook:", error);
    return false;
  }
}

export async function validateZapierConfig(config: ZapierConfig): Promise<boolean> {
  if (!config.webhookUrl || !config.webhookUrl.startsWith("https://")) {
    return false;
  }
  return true;
}
