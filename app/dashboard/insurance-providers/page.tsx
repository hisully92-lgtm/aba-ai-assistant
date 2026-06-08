"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

type ProviderType = "commercial" | "government";

type Provider = {
  name: string;
  type: ProviderType;
  abaCoverage: boolean;
  requiresAuth: boolean;
  notes: string;
  website: string;
  phone: string;
  authProcess: string;
  cptCodes: string[];
};

const PROVIDERS: Provider[] = [
  {
    name: "Blue Cross Blue Shield (BCBS)",
    type: "commercial",
    abaCoverage: true,
    requiresAuth: true,
    notes: "Coverage varies by state plan. Most plans cover medically necessary ABA therapy.",
    website: "https://www.bcbs.com",
    phone: "1-888-630-2583",
    authProcess: "Requires prior authorization with ASD diagnosis, treatment plan, and BCBA credentials.",
    cptCodes: ["97151", "97152", "97153", "97154", "97155", "97156", "97157", "97158"],
  },
  {
    name: "UnitedHealthcare (UHC)",
    type: "commercial",
    abaCoverage: true,
    requiresAuth: true,
    notes: "Comprehensive ABA benefits across many plans with medical necessity review.",
    website: "https://www.uhc.com",
    phone: "1-866-892-6765",
    authProcess: "Submit authorization through UHC Provider Portal with ASD diagnosis and treatment documentation.",
    cptCodes: ["97151", "97152", "97153", "97154", "97155", "97156", "97157", "97158"],
  },
  {
    name: "Aetna",
    type: "commercial",
    abaCoverage: true,
    requiresAuth: true,
    notes: "ABA coverage available under many commercial and self-funded plans.",
    website: "https://www.aetna.com",
    phone: "1-800-872-3862",
    authProcess: "Prior authorization required with BCBA treatment plan and baseline assessment.",
    cptCodes: ["97151", "97152", "97153", "97154", "97155", "97156", "97157", "97158"],
  },
  {
    name: "Medicaid",
    type: "government",
    abaCoverage: true,
    requiresAuth: true,
    notes: "Most states cover ABA under EPSDT mandates. Rules vary by state.",
    website: "https://www.medicaid.gov",
    phone: "1-877-267-2323",
    authProcess: "Requires ASD diagnosis, treatment plan, and state-specific authorization.",
    cptCodes: ["97151", "97152", "97153", "97154", "97155", "97156", "97157", "97158"],
  },
  {
    name: "TRICARE",
    type: "government",
    abaCoverage: true,
    requiresAuth: true,
    notes: "ABA coverage available through the Autism Care Demonstration (ACD).",
    website: "https://www.tricare.mil/autismcare",
    phone: "1-844-866-9378",
    authProcess: "Requires enrollment in ACD and authorization for each treatment plan.",
    cptCodes: ["97151", "97152", "97153", "97154", "97155", "97156", "97157", "97158"],
  },
];

const CPT_CODES: Record<string, { description: string; provider: string; maxUnits: string; notes: string }> = {
  "97151": {
    description: "Behavior identification assessment",
    provider: "BCBA / BCaBA",
    maxUnits: "No daily unit cap — time-based",
    notes: "Used for initial and ongoing behavioral assessments including FBA. Required to establish medical necessity and develop the BIP. Billed in 15-minute increments.",
  },
  "97152": {
    description: "Behavior identification supporting assessment",
    provider: "RBT / BT under BCBA supervision",
    maxUnits: "No daily unit cap — time-based",
    notes: "Used when additional personnel assist the BCBA during the assessment process. Must be billed on same date as 97151.",
  },
  "97153": {
    description: "Adaptive behavior treatment by protocol",
    provider: "RBT / BT under BCBA supervision",
    maxUnits: "96 units/day",
    notes: "Direct one-on-one ABA treatment delivered by a technician following the BCBA's written protocol. The most commonly billed ABA code.",
  },
  "97154": {
    description: "Group adaptive behavior treatment by protocol",
    provider: "RBT / BT",
    maxUnits: "32 units/day",
    notes: "ABA treatment delivered in a group setting (2 or more clients). Each client is billed individually.",
  },
  "97155": {
    description: "Adaptive behavior treatment with protocol modification",
    provider: "BCBA / BCaBA",
    maxUnits: "16 units/day",
    notes: "BCBA is present and modifying the treatment protocol in real time. Can be billed simultaneously with 97153 when BCBA is directly observing and adjusting.",
  },
  "97156": {
    description: "Family adaptive behavior treatment guidance",
    provider: "BCBA / BCaBA",
    maxUnits: "8 units/day",
    notes: "Caregiver training sessions conducted by a BCBA or BCaBA. Parent or guardian must be present. Required for insurance reauthorization documentation.",
  },
  "97157": {
    description: "Multiple-family group adaptive behavior treatment guidance",
    provider: "BCBA / BCaBA",
    maxUnits: "8 units/day",
    notes: "Caregiver training delivered to two or more families simultaneously. Each family is billed individually.",
  },
  "97158": {
    description: "Group protocol modification",
    provider: "BCBA / BCaBA",
    maxUnits: "16 units/day",
    notes: "BCBA modifies treatment protocols for two or more clients in a group setting. Each client billed individually.",
  },
};

const CPT_CATEGORIES = [
  {
    label: "Assessment Codes",
    codes: ["97151", "97152"],
    color: "border-purple-200 bg-purple-50",
    badgeColor: "bg-purple-100 text-purple-700",
    description: "Used for behavioral assessments, FBA, and establishing medical necessity.",
  },
  {
    label: "Direct Treatment Codes",
    codes: ["97153", "97154"],
    color: "border-blue-200 bg-blue-50",
    badgeColor: "bg-blue-100 text-blue-700",
    description: "Direct ABA therapy delivered by RBT/BT — individual and group.",
  },
  {
    label: "BCBA Supervision & Modification Codes",
    codes: ["97155", "97158"],
    color: "border-green-200 bg-green-50",
    badgeColor: "bg-green-100 text-green-700",
    description: "BCBA-level protocol modification and supervision during sessions.",
  },
  {
    label: "Family / Caregiver Training Codes",
    codes: ["97156", "97157"],
    color: "border-orange-200 bg-orange-50",
    badgeColor: "bg-orange-100 text-orange-700",
    description: "Caregiver training required for reauthorization — individual and group.",
  },
];

export default function InsuranceProvidersPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProviderType | "all">("all");
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"providers" | "cpt">("providers");
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const filteredProviders = useMemo(() => {
    return PROVIDERS.filter((provider) => {
      const matchesSearch = provider.name.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || provider.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [search, typeFilter]);

  return (
    <div className="space-y-6">
      <PageHeader title="Insurance Provider Guide">
        <p className="text-sm text-gray-500">Major insurance providers covering ABA therapy.</p>
      </PageHeader>

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "providers", label: "Insurance Providers" },
          { key: "cpt", label: "ABA CPT Codes" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as "providers" | "cpt")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* PROVIDERS TAB */}
      {activeTab === "providers" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search providers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex rounded-lg border border-gray-200 p-1">
              {(["all", "commercial", "government"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    typeFilter === type ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <span className="text-sm text-gray-400">{filteredProviders.length} providers</span>
          </div>

          <div className="space-y-4">
            {filteredProviders.map((provider) => {
              const isExpanded = expandedProvider === provider.name;
              return (
                <div key={provider.name} className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-800">{provider.name}</h3>
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${provider.type === "commercial" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                            {provider.type}
                          </span>
                          {provider.abaCoverage && (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">Covers ABA</span>
                          )}
                          {provider.requiresAuth && (
                            <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">Authorization Required</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{provider.notes}</p>
                      </div>
                      <button
                        onClick={() => setExpandedProvider(isExpanded ? null : provider.name)}
                        className="text-sm text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? "Hide" : "View"}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-5 space-y-5 border-t border-gray-100 pt-5">
                        <div>
                          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Authorization Process</h4>
                          <p className="text-sm text-gray-700">{provider.authProcess}</p>
                        </div>
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Covered CPT Codes</h4>
                          <div className="flex flex-wrap gap-2">
                            {provider.cptCodes.map((code) => (
                              <div key={code} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                                <p className="text-sm font-bold text-blue-700">{code}</p>
                                <p className="text-xs text-blue-600">{CPT_CODES[code]?.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <a href={provider.website} target="_blank" rel="noopener noreferrer"
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700">
                            Visit Website
                          </a>
                          <a href={`tel:${provider.phone.replace(/[^0-9]/g, "")}`}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50">
                            {provider.phone}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* CPT TAB */}
      {activeTab === "cpt" && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-bold mb-1">ABA CPT Code Reference — 8 Core Codes</p>
            <p>These are the standard CPT codes used for billing ABA therapy services. All codes bill in 15-minute units unless noted. Always verify payer-specific rules, rates, and authorization requirements before billing.</p>
          </div>

          {/* QUICK REFERENCE TABLE */}
          <Section title="Quick Reference">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Provider</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Max Units</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(CPT_CODES).map(([code, info], i) => (
                    <tr key={code} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                      <td className="py-2 px-3 font-bold text-blue-700">{code}</td>
                      <td className="py-2 px-3 text-gray-700">{info.description}</td>
                      <td className="py-2 px-3 text-gray-500 text-xs">{info.provider}</td>
                      <td className="py-2 px-3 text-gray-500 text-xs">{info.maxUnits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* CATEGORIZED CARDS */}
          <div className="space-y-4">
            {CPT_CATEGORIES.map((category) => (
              <div key={category.label} className={`border rounded-xl p-4 ${category.color}`}>
                <div className="mb-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${category.badgeColor}`}>{category.label}</span>
                  <p className="text-xs text-gray-500 mt-1">{category.description}</p>
                </div>
                <div className="space-y-2">
                  {category.codes.map((code) => {
                    const info = CPT_CODES[code];
                    const isExpanded = expandedCode === code;
                    return (
                      <div key={code} className="bg-white rounded-xl border border-gray-100 shadow-sm">
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <p className="text-xl font-bold text-blue-700 shrink-0">{code}</p>
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{info.description}</p>
                                <p className="text-xs text-gray-500 mt-0.5">Provider: {info.provider}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="text-xs font-medium text-gray-700">{info.maxUnits}</p>
                                <p className="text-xs text-gray-400">15-min units</p>
                              </div>
                              <button
                                onClick={() => setExpandedCode(isExpanded ? null : code)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                {isExpanded ? "Less ▲" : "More ▼"}
                              </button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs text-gray-600 leading-relaxed">{info.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">
            Always verify payer-specific rules, rates, and authorization requirements before billing. CPT codes are updated annually by the AMA.
          </p>
        </div>
      )}
    </div>
  );
}