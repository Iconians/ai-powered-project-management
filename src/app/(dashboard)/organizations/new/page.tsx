"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewOrganizationPage() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create organization");
      }

      await res.json(); // Response not needed, just ensure it's successful
      router.push("/boards");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/boards"
          className="text-sm sm:text-base text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-4 inline-block"
        >
          ← Back to Boards
        </Link>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 lg:p-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
            Create Organization
          </h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Organization Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="My Company"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? "Creating..." : "Create Organization"}
              </button>
              <Link
                href="/boards"
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-center text-sm sm:text-base"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
