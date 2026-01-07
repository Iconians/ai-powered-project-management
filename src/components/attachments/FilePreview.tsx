"use client";

import { useState } from "react";

interface FilePreviewProps {
  file: {
    id: string;
    fileName: string;
    mimeType: string;
    signedUrl?: string | null;
    fileSize: number;
  };
}

export function FilePreview({ file }: FilePreviewProps) {
  const [error, setError] = useState(false);

  const isImage = file.mimeType.startsWith("image/");
  const isPDF = file.mimeType === "application/pdf";
  const isVideo = file.mimeType.startsWith("video/");

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (!file.signedUrl) {
    return (
      <div className="p-4 border border-gray-300 dark:border-gray-600 rounded">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {file.fileName} ({formatFileSize(file.fileSize)})
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          URL expired. Please refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
      {isImage && !error ? (
        <img
          src={file.signedUrl}
          alt={file.fileName}
          onError={() => setError(true)}
          className="w-full h-auto max-h-96 object-contain"
        />
      ) : isPDF ? (
        <iframe
          src={file.signedUrl}
          className="w-full h-96"
          title={file.fileName}
        />
      ) : isVideo ? (
        <video
          src={file.signedUrl}
          controls
          className="w-full h-auto max-h-96"
        />
      ) : (
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {file.fileName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {formatFileSize(file.fileSize)}
          </p>
          <a
            href={file.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
          >
            Open in new tab
          </a>
        </div>
      )}
    </div>
  );
}

