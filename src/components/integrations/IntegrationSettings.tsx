"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IntegrationProvider } from "@prisma/client";

interface IntegrationSettingsProps {
  organizationId: string;
}

interface Integration {
  id: string;
  provider: IntegrationProvider;
  config: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function IntegrationSettings({ organizationId }: IntegrationSettingsProps) {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);
  const [config, setConfig] = useState<any>({});
  const [showInstructions, setShowInstructions] = useState<IntegrationProvider | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const { data: integrations, error: integrationsError } = useQuery({
    queryKey: ["integrations", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/integrations?organizationId=${organizationId}`);
      if (!res.ok) {
        // Return empty array if error - integrations are optional
        console.warn("Failed to fetch integrations:", res.statusText);
        return [] as Integration[];
      }
      return res.json() as Promise<Integration[]>;
    },
    retry: false, // Don't retry on error
  });

  const createMutation = useMutation({
    mutationFn: async (data: { provider: IntegrationProvider; config: any }) => {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          provider: data.provider,
          config: data.config,
        }),
      });
      if (!res.ok) throw new Error("Failed to create integration");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", organizationId] });
      setSelectedProvider(null);
      setConfig({});
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, config: newConfig, isActive }: { id: string; config?: any; isActive?: boolean }) => {
      const res = await fetch(`/api/integrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: newConfig, isActive }),
      });
      if (!res.ok) throw new Error("Failed to update integration");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", organizationId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/integrations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete integration");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", organizationId] });
    },
  });

  const testMutation = useMutation({
    mutationFn: async ({ integrationId, action, payload }: { integrationId: string; action: string; payload?: any }) => {
      try {
        const res = await fetch(`/api/integrations/${integrationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            payload,
          }),
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: "Test failed" }));
          throw new Error(error.error || "Test failed");
        }
        return res.json();
      } catch (error) {
        // Handle network errors gracefully
        throw error instanceof Error ? error : new Error("Network error");
      }
    },
  });

  const renderProviderConfig = (provider: IntegrationProvider) => {
    switch (provider) {
      case IntegrationProvider.SLACK:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Webhook URL
              </label>
              <input
                type="text"
                value={config.webhookUrl || ""}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Channel (optional)
              </label>
              <input
                type="text"
                value={config.channel || ""}
                onChange={(e) => setConfig({ ...config, channel: e.target.value })}
                placeholder="#general"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username (optional)
              </label>
              <input
                type="text"
                value={config.username || ""}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder="Project Management"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        );

      case IntegrationProvider.JIRA:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={config.baseUrl || ""}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                placeholder="https://yourcompany.atlassian.net"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={config.email || ""}
                onChange={(e) => setConfig({ ...config, email: e.target.value })}
                placeholder="your@email.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Token
              </label>
              <input
                type="password"
                value={config.apiToken || ""}
                onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
                placeholder="Your Jira API token"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project Key
              </label>
              <input
                type="text"
                value={config.projectKey || ""}
                onChange={(e) => setConfig({ ...config, projectKey: e.target.value })}
                placeholder="PROJ"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        );

      case IntegrationProvider.LINEAR:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={config.apiKey || ""}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="lin_api_..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Team ID
              </label>
              <input
                type="text"
                value={config.teamId || ""}
                onChange={(e) => setConfig({ ...config, teamId: e.target.value })}
                placeholder="Team UUID"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        );

      case IntegrationProvider.ZAPIER:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Webhook URL
              </label>
              <input
                type="text"
                value={config.webhookUrl || ""}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const handleSave = () => {
    if (!selectedProvider) return;
    createMutation.mutate({ provider: selectedProvider, config });
  };

  const handleTest = async (integration: Integration) => {
    testMutation.mutate({
      integrationId: integration.id,
      action: "test",
    });
  };

  const getWebhookUrl = (provider: IntegrationProvider): string | null => {
    if (typeof window === "undefined") return null;
    const baseUrl = window.location.origin;
    switch (provider) {
      case IntegrationProvider.SLACK:
        return `${baseUrl}/api/integrations/slack/webhook?organizationId=${organizationId}`;
      case IntegrationProvider.JIRA:
        return `${baseUrl}/api/integrations/jira/webhook?organizationId=${organizationId}`;
      case IntegrationProvider.LINEAR:
        return `${baseUrl}/api/integrations/linear/webhook?organizationId=${organizationId}`;
      default:
        return null;
    }
  };

  const handleCopyWebhookUrl = (provider: IntegrationProvider) => {
    const url = getWebhookUrl(provider);
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(provider);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  const existingIntegrations = integrations || [];

  if (integrationsError) {
    // Silently handle errors - integrations are optional
    console.warn("Integrations not available:", integrationsError);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Integrations (Optional)
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Connect your project management tools with external services. Configure API keys when ready.
        </p>
      </div>

      {/* Existing Integrations */}
      <div className="space-y-4">
        {existingIntegrations.map((integration) => {
          const webhookUrl = getWebhookUrl(integration.provider);
          return (
            <div
              key={integration.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {integration.provider}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {integration.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(integration)}
                    disabled={testMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    {testMutation.isPending ? "Testing..." : "Test"}
                  </button>
                  <button
                    onClick={() =>
                      updateMutation.mutate({
                        id: integration.id,
                        isActive: !integration.isActive,
                      })
                    }
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      integration.isActive
                        ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {integration.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this integration?")) {
                        deleteMutation.mutate(integration.id);
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Webhook URL for bidirectional sync */}
              {webhookUrl && integration.isActive && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                  <label className="block text-xs font-medium text-blue-900 dark:text-blue-200 mb-2">
                    📡 Webhook URL (for {integration.provider} to send events to your app)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="flex-1 px-3 py-2 text-xs border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => handleCopyWebhookUrl(integration.provider)}
                      className="px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                    >
                      {copiedUrl === integration.provider ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                    Copy this URL and configure it in your {integration.provider} workspace settings
                  </p>
                </div>
              )}

              {/* Setup Instructions Toggle */}
              <div className="mt-3">
                <button
                  onClick={() =>
                    setShowInstructions(
                      showInstructions === integration.provider ? null : integration.provider
                    )
                  }
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showInstructions === integration.provider ? "▼" : "▶"} Setup Instructions
                </button>
                {showInstructions === integration.provider && (
                  <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700 text-xs space-y-3">
                    {integration.provider === IntegrationProvider.SLACK && (
                      <>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white mb-1">
                            Step 1: Create Slack Webhook (for notifications TO Slack)
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-2">
                            <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">api.slack.com/apps</a></li>
                            <li>Create a new app or select existing</li>
                            <li>Enable "Incoming Webhooks"</li>
                            <li>Add webhook to workspace and copy the webhook URL</li>
                            <li>Paste it in the Webhook URL field above</li>
                          </ol>
                        </div>
                        {webhookUrl && (
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white mb-1">
                              Step 2: Configure Webhook URL in Slack (for events FROM Slack)
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-2">
                              <li>In your Slack app settings, go to "Interactivity & Shortcuts" or "Slash Commands"</li>
                              <li>Copy the Webhook URL shown above</li>
                              <li>Paste it as the Request URL in Slack</li>
                            </ol>
                          </div>
                        )}
                      </>
                    )}
                    {integration.provider === IntegrationProvider.JIRA && (
                      <>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white mb-1">
                            Step 1: Create Jira API Token
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-2">
                            <li>Go to <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Atlassian API Tokens</a></li>
                            <li>Create a new API token</li>
                            <li>Copy the token and paste it above</li>
                          </ol>
                        </div>
                        {webhookUrl && (
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white mb-1">
                              Step 2: Configure Webhook in Jira (for bidirectional sync)
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-2">
                              <li>In Jira: Settings → System → Webhooks</li>
                              <li>Create a new webhook</li>
                              <li>Copy the Webhook URL shown above</li>
                              <li>Select events: "Issue Created", "Issue Updated"</li>
                              <li>Save the webhook</li>
                            </ol>
                          </div>
                        )}
                      </>
                    )}
                    {integration.provider === IntegrationProvider.LINEAR && (
                      <>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white mb-1">
                            Step 1: Create Linear API Key
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-2">
                            <li>Go to <a href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Linear API Settings</a></li>
                            <li>Create a new API key</li>
                            <li>Copy the key (starts with <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">lin_api_</code>)</li>
                            <li>Paste it above along with your Team ID</li>
                          </ol>
                        </div>
                        {webhookUrl && (
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white mb-1">
                              Step 2: Configure Webhook in Linear (for bidirectional sync)
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-2">
                              <li>In Linear: Settings → API → Webhooks</li>
                              <li>Create a new webhook</li>
                              <li>Copy the Webhook URL shown above</li>
                              <li>Select events: "Issue Created", "Issue Updated"</li>
                              <li>Save the webhook</li>
                            </ol>
                          </div>
                        )}
                      </>
                    )}
                    {integration.provider === IntegrationProvider.ZAPIER && (
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white mb-1">
                          Zapier Setup
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-2">
                          <li>Go to <a href="https://zapier.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Zapier</a> and create a Zap</li>
                          <li>Choose "Webhooks by Zapier" as the trigger</li>
                          <li>Select "Catch Hook"</li>
                          <li>Copy the webhook URL from Zapier</li>
                          <li>Paste it in the Webhook URL field above</li>
                          <li>When tasks are created/updated, they'll be sent to your Zapier webhook</li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {testMutation.isError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {testMutation.error?.message || "Test failed"}
                </p>
              )}
              {testMutation.isSuccess && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400">Test successful!</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Add New Integration */}
      {!selectedProvider ? (
        <div>
          <button
            onClick={() => setSelectedProvider(IntegrationProvider.SLACK)}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
          >
            <div className="font-medium text-gray-900 dark:text-white">Add Slack</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Receive notifications in Slack channels
            </div>
          </button>
          <button
            onClick={() => setSelectedProvider(IntegrationProvider.JIRA)}
            className="w-full mt-2 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
          >
            <div className="font-medium text-gray-900 dark:text-white">Add Jira</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Sync tasks with Jira issues
            </div>
          </button>
          <button
            onClick={() => setSelectedProvider(IntegrationProvider.LINEAR)}
            className="w-full mt-2 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
          >
            <div className="font-medium text-gray-900 dark:text-white">Add Linear</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Sync tasks with Linear issues
            </div>
          </button>
          <button
            onClick={() => setSelectedProvider(IntegrationProvider.ZAPIER)}
            className="w-full mt-2 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
          >
            <div className="font-medium text-gray-900 dark:text-white">Add Zapier</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Connect with 6000+ apps via Zapier
            </div>
          </button>
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 dark:text-white">
              Configure {selectedProvider}
            </h4>
            <button
              onClick={() => {
                setSelectedProvider(null);
                setConfig({});
              }}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
          {renderProviderConfig(selectedProvider)}

          {/* Show webhook URL for providers that need it */}
          {selectedProvider && selectedProvider !== IntegrationProvider.ZAPIER && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <label className="block text-xs font-medium text-blue-900 dark:text-blue-200 mb-2">
                📡 Your Webhook URL (for {selectedProvider} to send events to your app)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getWebhookUrl(selectedProvider) || ""}
                  className="flex-1 px-3 py-2 text-xs border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => selectedProvider && handleCopyWebhookUrl(selectedProvider)}
                  className="px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                >
                  {copiedUrl === selectedProvider ? "✓ Copied!" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                After saving your credentials, copy this URL and configure it in your {selectedProvider} workspace
              </p>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSave}
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
