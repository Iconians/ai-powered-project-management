interface ProfileDangerZoneProps {
  onOpenDelete: () => void;
}

export function ProfileDangerZone({ onOpenDelete }: ProfileDangerZoneProps) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
      <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">
        Danger Zone
      </h2>
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          Once you delete your account, there is no going back. This will:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 mb-4 space-y-1">
          <li>
            Delete all your organizations (if you&apos;re the only member)
          </li>
          <li>Delete all boards and tasks you created</li>
          <li>Remove you from all organizations you&apos;re a member of</li>
        </ul>
        <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-4">
          Note: You cannot delete your account if you are the only administrator
          for an organization with other members. Please assign another
          administrator first.
        </p>
        <button
          type="button"
          onClick={onOpenDelete}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
