"use client";

import { usePlan } from "@/lib/billing/usePlan";

export default function ProFeature({
  children,
}: {
  children: React.ReactNode;
}) {
  const { plan } = usePlan();

  if (plan !== "pro") {
    return (
      <div className="p-6 border rounded-lg text-center">
        <h3 className="text-lg font-semibold">Pro Feature</h3>
        <p className="text-gray-600 mt-2">
          Upgrade to access this feature.
        </p>
        <a href="/dashboard/upgrade" className="text-blue-600 underline">
          Upgrade now
        </a>
      </div>
    );
  }

  return <>{children}</>;
}