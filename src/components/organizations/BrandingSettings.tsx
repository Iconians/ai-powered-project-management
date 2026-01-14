"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface BrandingSettingsProps {
  organizationId: string;
  onClose: () => void;
}

interface Settings {
  organizationId: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customDomain: string | null;
}

export function BrandingSettings({ organizationId, onClose }: BrandingSettingsProps) {
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3B82F6");
  const [secondaryColor, setSecondaryColor] = useState("#8B5CF6");
  const [customDomain, setCustomDomain] = useState("");
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["organization-settings", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/settings`);
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (settings) {
      setLogoUrl(settings.logoUrl || "");
      setPrimaryColor(settings.primaryColor || "#3B82F6");
      setSecondaryColor(settings.secondaryColor || "#8B5CF6");
      setCustomDomain(settings.customDomain || "");
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Settings>) => {
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
      queryClient.invalidateQueries({ queryKey: ["organization-settings", organizationId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      logoUrl: logoUrl || null,
      primaryColor: primaryColor || null,
      secondaryColor: secondaryColor || null,
      customDomain: customDomain || null,
    });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 xs:p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 xs:p-4 sm:p-6 max-w-2xl w-full mx-2 xs:mx-4 max-h-[95vh] overflow-y-auto">
          <div className="text-center py-8 text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 xs:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 xs:p-4 sm:p-6 max-w-2xl w-full mx-2 xs:mx-4 max-h-[95vh] xs:max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Branding Settings
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Logo URL
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="https://example.com/logo.png"
            />
            {logoUrl && (
              <div className="mt-2">
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="h-16 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Primary Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="#3B82F6"
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
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="#8B5CF6"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Custom Domain
            </label>
            <input
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="app.yourcompany.com"
            />
            <p className="mt-1 text-xs text-gray-500">
              Configure DNS to point to this application
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
