"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  clinic_code: string | null;
};

export default function CompanyBanner() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: companyUsers } = await supabase
      .from("company_users")
      .select("company_id, role, status, companies(id, name, clinic_code)")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (!companyUsers || companyUsers.length === 0) { setLoading(false); return; }

    const list: Company[] = companyUsers
      .map((cu: any) => cu.companies)
      .filter(Boolean);

    setCompanies(list);

    // Check if user has a saved active company in localStorage
    const savedId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;
    const saved = list.find(c => c.id === savedId);
    setActiveCompany(saved ?? list[0]);

    // Get role for active company
    const activeCu = companyUsers.find((cu: any) => cu.companies?.id === (saved ?? list[0])?.id);
    setRole(activeCu?.role ?? null);

    setLoading(false);
  }

  function switchCompany(company: Company) {
    setActiveCompany(company);
    localStorage.setItem("activeCompanyId", company.id);
    setOpen(false);
    // Reload so all data refreshes for new company context
    window.location.reload();
  }

  function roleBadgeColor(role: string | null) {
    if (role === "admin") return "bg-purple-100 text-purple-700";
    if (role === "supervisor" || role === "clinical_director") return "bg-blue-100 text-blue-700";
    if (role === "clinician" || role === "rbt" || role === "bt") return "bg-green-100 text-green-700";
    if (role === "student_analyst") return "bg-yellow-100 text-yellow-700";
    if (role === "parent") return "bg-pink-100 text-pink-700";
    return "bg-gray-100 text-gray-600";
  }

  if (loading || !activeCompany) return null;

  const hasMultiple = companies.length > 1;

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-2 flex items-center justify-between relative">
      <div className="flex items-center gap-3">
        {hasMultiple ? (
          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors"
            >
              <span>{activeCompany.name}</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Switch Clinic</p>
                  </div>
                  {companies.map(company => (
                    <button
                      key={company.id}
                      onClick={() => switchCompany(company)}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${company.id === activeCompany.id ? "bg-blue-50" : ""}`}
                    >
                      <div>
                        <p className={`font-medium ${company.id === activeCompany.id ? "text-blue-700" : "text-gray-800"}`}>
                          {company.name}
                        </p>
                        {company.clinic_code && (
                          <p className="text-xs text-gray-400 font-mono">{company.clinic_code}</p>
                        )}
                      </div>
                      {company.id === activeCompany.id && (
                        <span className="text-blue-500 text-xs font-medium">Active</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <span className="text-sm font-semibold text-gray-700">{activeCompany.name}</span>
        )}

        {role && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${roleBadgeColor(role)}`}>
            {role.replace("_", " ")}
          </span>
        )}

        {hasMultiple && (
          <span className="text-xs text-gray-400">{companies.length} clinics</span>
        )}
      </div>

      <p className="text-xs text-gray-400">ABA AI</p>
    </div>
  );
}