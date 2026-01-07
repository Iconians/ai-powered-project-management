"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface BrandingSettingsProps {
  organizationId: string;
  userRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

export function BrandingSettings({
  organizationId,
  userRole,
}: BrandingSettingsProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    logoUrl: "",
    primaryColor: "#3B82F6",
    secondaryColor: "#8B5CF6",
    customDomain: "",
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["organization-settings", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/settings`);
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch(`/api/organizations/${organizationId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization-settings", organizationId],
      });
      alert("Settings updated successfully!");
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        logoUrl: settings.logoUrl || "",
        primaryColor: settings.primaryColor || "#3B82F6",
        secondaryColor: settings.secondaryColor || "#8B5CF6",
        customDomain: settings.customDomain || "",
      });
    }
  }, [settings]);

  const canEdit = userRole === "ADMIN";

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
        Branding Settings
      </h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate(formData);
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Logo URL
          </label>
          <input
            type="url"
            value={formData.logoUrl}
            onChange={(e) =>
              setFormData({ ...formData, logoUrl: e.target.value })
            }
            disabled={!canEdit}
            placeholder="https://example.com/logo.png"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Primary Color
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={formData.primaryColor}
              onChange={(e) =>
                setFormData({ ...formData, primaryColor: e.target.value })
              }
              disabled={!canEdit}
              className="w-16 h-10 rounded border border-gray-300 dark:border-gray-600"
            />
            <input
              type="text"
              value={formData.primaryColor}
              onChange={(e) =>
                setFormData({ ...formData, primaryColor: e.target.value })
              }
              disabled={!canEdit}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Secondary Color
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={formData.secondaryColor}
              onChange={(e) =>
                setFormData({ ...formData, secondaryColor: e.target.value })
              }
              disabled={!canEdit}
              className="w-16 h-10 rounded border border-gray-300 dark:border-gray-600"
            />
            <input
              type="text"
              value={formData.secondaryColor}
              onChange={(e) =>
                setFormData({ ...formData, secondaryColor: e.target.value })
              }
              disabled={!canEdit}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Custom Domain
          </label>
          <input
            type="text"
            value={formData.customDomain}
            onChange={(e) =>
              setFormData({ ...formData, customDomain: e.target.value })
            }
            disabled={!canEdit}
            placeholder="app.example.com"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Configure DNS settings to point to this application
          </p>
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

