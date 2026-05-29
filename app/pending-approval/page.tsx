"use client";

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Setup Incomplete</h1>
        <p className="text-sm text-gray-500">Your account setup is not complete. Please finish onboarding.</p>
        <a href="/onboarding" className="inline-block w-full bg-blue-600 text-white font-semibold py-3 rounded-lg text-sm">Complete Setup</a>
      </div>
    </div>
  );
}
