"use client";

import { useState } from "react";
import { BrandingSettings } from "./BrandingSettings";

interface BrandingButtonProps {
  organizationId: string;
}

export function BrandingButton({ organizationId }: BrandingButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Branding
        </h3>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
        >
          Configure Branding
        </button>
      </div>
      {showModal && (
        <BrandingSettings
          organizationId={organizationId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
