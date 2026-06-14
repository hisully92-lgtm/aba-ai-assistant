"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-96 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-red-100 shadow-md p-8 text-center space-y-5">
        <div className="text-4xl">🔧</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Page failed to load</h2>
          <p className="text-gray-500 text-sm mt-2">
            This section encountered an error. Try refreshing or go back to the dashboard.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 mt-2 font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors text-center"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}