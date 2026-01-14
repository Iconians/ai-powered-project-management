"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ImportModalProps {
  boardId: string;
  onClose: () => void;
}

export function ImportModal({ boardId, onClose }: ImportModalProps) {
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (data: { format: string; content: string | object }) => {
      const res = await fetch("/api/boards/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          data: data.content,
          format: data.format,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        // Create a custom error object that includes the full error response
        const error = new Error(errorData.message || errorData.error || "Failed to import") as any;
        error.response = { data: errorData };
        throw error;
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      
      if (data.warnings) {
        // Show warnings but still close modal
        alert(`Imported ${data.imported} task(s)!\n\nWarnings:\n${data.errors?.slice(0, 5).join("\n") || ""}${data.errors && data.errors.length > 5 ? `\n... and ${data.errors.length - 5} more errors` : ""}`);
      } else {
        alert(`Successfully imported ${data.imported} task(s)!`);
      }
      onClose();
    },
    onError: (error: any) => {
      // Extract error message from API response
      let errorMessage = "Failed to import";
      let errorDetails: string[] = [];
      
      try {
        // If error has a response with JSON data
        if (error?.response?.data) {
          const errorData = error.response.data;
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
          if (errorData.details && Array.isArray(errorData.details)) {
            errorDetails = errorData.details;
          }
        } else if (error?.message) {
          errorMessage = error.message;
        }
      } catch (e) {
        // Use original error message if parsing fails
        errorMessage = error?.message || "Unknown error occurred";
      }
      
      // Build the full error message
      let fullMessage = errorMessage;
      if (errorDetails.length > 0) {
        const preview = errorDetails.slice(0, 5).join("\n");
        fullMessage += `\n\nErrors:\n${preview}${errorDetails.length > 5 ? `\n... and ${errorDetails.length - 5} more` : ""}`;
      }
      fullMessage += "\n\nPlease check:\n- CSV format matches the expected structure\n- Priority values are: LOW, MEDIUM, HIGH, or URGENT (case-insensitive)\n- Status values are valid\n- All required fields are present";
      
      alert(fullMessage);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) {
      alert("Please select a file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (format === "json") {
        try {
          const jsonData = JSON.parse(content);
          importMutation.mutate({
            format,
            content: jsonData,
          });
        } catch (error) {
          alert("Invalid JSON file. Please check the format.");
        }
      } else {
        // CSV is sent as string
        importMutation.mutate({
          format,
          content,
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 xs:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 xs:p-4 sm:p-6 max-w-2xl w-full mx-2 xs:mx-4 max-h-[95vh] xs:max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Import Tasks
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Format
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="json"
                  checked={format === "json"}
                  onChange={(e) => setFormat(e.target.value as "json" | "csv")}
                  className="mr-2"
                />
                <span className="text-sm text-gray-900 dark:text-white">JSON</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="csv"
                  checked={format === "csv"}
                  onChange={(e) => setFormat(e.target.value as "json" | "csv")}
                  className="mr-2"
                />
                <span className="text-sm text-gray-900 dark:text-white">CSV</span>
              </label>
            </div>
          </div>

          {/* Format Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Expected {format.toUpperCase()} Format:
            </h3>
            {format === "csv" ? (
              <div className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
                <p className="font-medium">Option 1: Task List Format (Recommended)</p>
                <pre className="bg-white dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto">
{`Title,Description,Status,Priority,Assignee,Due Date
Task 1,Description here,TODO,HIGH,user@example.com,2024-12-31
Task 2,Another task,IN_PROGRESS,MEDIUM,,2024-12-25`}
                </pre>
                <p className="font-medium mt-3">Option 2: Kanban Board Format</p>
                <pre className="bg-white dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto">
{`To Do,In Progress,In Review,Done
Task 1,Task 3,Task 2,Task 4
,Task 5,,Task 6
`}
                </pre>
                <p className="text-xs mt-2">
                  <strong>Note:</strong> Status columns accept: To Do, In Progress, In Review, Done, Blocked
                </p>
              </div>
            ) : (
              <div className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
                <p className="font-medium">JSON Format:</p>
                <pre className="bg-white dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto">
{`{
  "tasks": [
    {
      "title": "Task 1",
      "description": "Description here",
      "status": "TODO",
      "priority": "HIGH",
      "dueDate": "2024-12-31"
    },
    {
      "title": "Task 2",
      "status": "IN_PROGRESS",
      "priority": "MEDIUM"
    }
  ]
}`}
                </pre>
                <p className="text-xs mt-2">
                  <strong>Fields:</strong> title (required), description, status (TODO/IN_PROGRESS/IN_REVIEW/DONE/BLOCKED), priority (LOW/MEDIUM/HIGH/URGENT), dueDate, estimatedHours, tags (array)
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              File
            </label>
            <input
              type="file"
              accept={format === "json" ? ".json" : ".csv"}
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!file || importMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {importMutation.isPending ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

