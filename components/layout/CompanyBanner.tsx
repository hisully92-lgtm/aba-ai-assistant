"use client";

import { useCompany } from "@/lib/hooks/useCompany";

export default function CompanyBanner() {
  const { companyName, role, loading } = useCompany();

  if (loading || !companyName) return null;

  function roleBadgeColor(role: string | null) {
    if (role === "admin") return "bg-purple-100 text-purple-700";
    if (role === "supervisor" || role === "clinical_director") return "bg-blue-100 text-blue-700";
    if (role === "clinician" || role === "rbt" || role === "bt") return "bg-green-100 text-green-700";
    if (role === "student_analyst") return "bg-yellow-100 text-yellow-700";
    if (role === "parent") return "bg-pink-100 text-pink-700";
    return "bg-gray-100 text-gray-600";
  }

  return (
    <div className="border-b border-gray-200 bg-white px-8 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-700">{companyName}</span>
        {role && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${roleBadgeColor(role)}`}>
            {role.replace("_", " ")}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400">ABA AI Assistant</p>
    </div>
  );
}