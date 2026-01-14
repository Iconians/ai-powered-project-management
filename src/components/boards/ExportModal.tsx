"use client";

import { useState } from "react";

interface ExportModalProps {
  boardId: string;
  boardName: string;
  onClose: () => void;
}

export function ExportModal({ boardId, boardName, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/export?format=${format}`);
      if (!res.ok) throw new Error("Failed to export");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `board-${boardName}-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onClose();
    } catch (error) {
      alert("Failed to export board");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 xs:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 xs:p-4 sm:p-6 max-w-md w-full mx-2 xs:mx-4 max-h-[95vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Export Board
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
                <span className="text-sm text-gray-900 dark:text-white">
                  JSON (includes all data)
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="csv"
                  checked={format === "csv"}
                  onChange={(e) => setFormat(e.target.value as "json" | "csv")}
                  className="mr-2"
                />
                <span className="text-sm text-gray-900 dark:text-white">
                  CSV (spreadsheet format)
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isExporting ? "Exporting..." : "Export"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

