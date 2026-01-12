"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface RoleEditorProps {
  organizationId: string;
}

interface CustomRole {
  id: string;
  name: string;
  permissions: any;
  createdAt: string;
  _count?: {
    members: number;
  };
}

interface PermissionFlags {
  canCreateBoards?: boolean;
  canDeleteBoards?: boolean;
  canManageMembers?: boolean;
  canManageSettings?: boolean;
  canViewAnalytics?: boolean;
  canExportData?: boolean;
  canManageIntegrations?: boolean;
  canManageRoles?: boolean;
}

export function RoleEditor({ organizationId }: RoleEditorProps) {
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState<PermissionFlags>({});

  const { data: roles } = useQuery({
    queryKey: ["roles", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/roles`);
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json() as Promise<CustomRole[]>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; permissions: PermissionFlags }) => {
      const res = await fetch(`/api/organizations/${organizationId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", organizationId] });
      setRoleName("");
      setPermissions({});
      setEditingRole(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ roleId, name, permissions: perms }: { roleId: string; name?: string; permissions?: PermissionFlags }) => {
      const res = await fetch(`/api/organizations/${organizationId}/roles/${roleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions: perms }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", organizationId] });
      setEditingRole(null);
      setRoleName("");
      setPermissions({});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/roles/${roleId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", organizationId] });
    },
  });

  const handleEdit = (role: CustomRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setPermissions(role.permissions || {});
  };

  const handleSave = () => {
    if (editingRole) {
      updateMutation.mutate({
        roleId: editingRole.id,
        name: roleName,
        permissions,
      });
    } else {
      createMutation.mutate({
        name: roleName,
        permissions,
      });
    }
  };

  const permissionOptions: Array<{ key: keyof PermissionFlags; label: string; description: string }> = [
    { key: "canCreateBoards", label: "Create Boards", description: "Allow creating new boards" },
    { key: "canDeleteBoards", label: "Delete Boards", description: "Allow deleting boards" },
    { key: "canManageMembers", label: "Manage Members", description: "Add and remove organization members" },
    { key: "canManageSettings", label: "Manage Settings", description: "Modify organization settings" },
    { key: "canViewAnalytics", label: "View Analytics", description: "Access analytics and reports" },
    { key: "canExportData", label: "Export Data", description: "Export board and task data" },
    { key: "canManageIntegrations", label: "Manage Integrations", description: "Configure integrations" },
    { key: "canManageRoles", label: "Manage Roles", description: "Create and edit custom roles" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Custom Roles
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Create custom roles with specific permissions for your organization
        </p>
      </div>

      {/* Existing Roles */}
      <div className="space-y-4">
        {roles?.map((role) => (
          <div
            key={role.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">{role.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {role._count?.members || 0} member{role._count?.members !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(role)}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this role?")) {
                      deleteMutation.mutate(role.id);
                    }
                  }}
                  disabled={deleteMutation.isPending || (role._count?.members || 0) > 0}
                  className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </div>
            </div>
            {deleteMutation.isError && deleteMutation.variables === role.id && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {deleteMutation.error?.message || "Failed to delete role"}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Create/Edit Role Form */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900 dark:text-white">
            {editingRole ? `Edit ${editingRole.name}` : "Create New Role"}
          </h4>
          {editingRole && (
            <button
              onClick={() => {
                setEditingRole(null);
                setRoleName("");
                setPermissions({});
              }}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role Name
            </label>
            <input
              type="text"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g., Project Manager"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Permissions
            </label>
            <div className="space-y-2">
              {permissionOptions.map((option) => (
                <label
                  key={option.key}
                  className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={permissions[option.key] || false}
                    onChange={(e) =>
                      setPermissions({
                        ...permissions,
                        [option.key]: e.target.checked,
                      })
                    }
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!roleName.trim() || createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingRole
                ? "Update Role"
                : "Create Role"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
