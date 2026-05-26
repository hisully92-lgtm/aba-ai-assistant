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
    notes:
      "Coverage varies by state plan. Most plans cover medically necessary ABA therapy.",
    website: "https://www.bcbs.com",
    phone: "1-888-630-2583",
    authProcess:
      "Requires prior authorization with ASD diagnosis, treatment plan, and BCBA credentials.",
    cptCodes: ["97153", "97154", "97155", "97156", "97157", "97158"],
  },
  {
    name: "UnitedHealthcare (UHC)",
    type: "commercial",
    abaCoverage: true,
    requiresAuth: true,
    notes:
      "Comprehensive ABA benefits across many plans with medical necessity review.",
    website: "https://www.uhc.com",
    phone: "1-866-892-6765",
    authProcess:
      "Submit authorization through UHC Provider Portal with ASD diagnosis and treatment documentation.",
    cptCodes: ["97153", "97154", "97155", "97156", "97157", "97158"],
  },
  {
    name: "Aetna",
    type: "commercial",
    abaCoverage: true,
    requiresAuth: true,
    notes:
      "ABA coverage available under many commercial and self-funded plans.",
    website: "https://www.aetna.com",
    phone: "1-800-872-3862",
    authProcess:
      "Prior authorization required with BCBA treatment plan and baseline assessment.",
    cptCodes: ["97153", "97154", "97155", "97156", "97157", "97158"],
  },
  {
    name: "Medicaid",
    type: "government",
    abaCoverage: true,
    requiresAuth: true,
    notes:
      "Most states cover ABA under EPSDT mandates. Rules vary by state.",
    website: "https://www.medicaid.gov",
    phone: "1-877-267-2323",
    authProcess:
      "Requires ASD diagnosis, treatment plan, and state-specific authorization.",
    cptCodes: ["97153", "97154", "97155", "97156", "97157", "97158"],
  },
  {
    name: "TRICARE",
    type: "government",
    abaCoverage: true,
    requiresAuth: true,
    notes:
      "ABA coverage available through the Autism Care Demonstration (ACD).",
    website: "https://www.tricare.mil/autismcare",
    phone: "1-844-866-9378",
    authProcess:
      "Requires enrollment in ACD and authorization for each treatment plan.",
    cptCodes: ["97153", "97154", "97155", "97156", "97157", "97158"],
  },
];

const CPT_CODES: Record<
  string,
  {
    description: string;
    provider: string;
    maxUnits: string;
  }
> = {
  "97153": {
    description: "Adaptive behavior treatment by protocol",
    provider: "RBT / BT under BCBA supervision",
    maxUnits: "96 units/day",
  },
  "97154": {
    description: "Group adaptive behavior treatment",
    provider: "RBT / BT",
    maxUnits: "32 units/day",
  },
  "97155": {
    description: "Protocol modification by BCBA",
    provider: "BCBA / BCaBA",
    maxUnits: "16 units/day",
  },
  "97156": {
    description: "Family guidance",
    provider: "BCBA / BCaBA",
    maxUnits: "8 units/day",
  },
  "97157": {
    description: "Multiple-family group guidance",
    provider: "BCBA / BCaBA",
    maxUnits: "8 units/day",
  },
  "97158": {
    description: "Group protocol modification",
    provider: "BCBA / BCaBA",
    maxUnits: "16 units/day",
  },
};

export default function InsuranceProvidersPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] =
    useState<ProviderType | "all">("all");

  const [expandedProvider, setExpandedProvider] = useState<string | null>(
    null
  );

  const [activeTab, setActiveTab] = useState<"providers" | "cpt">(
    "providers"
  );

  const filteredProviders = useMemo(() => {
    return PROVIDERS.filter((provider) => {
      const matchesSearch = provider.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesType =
        typeFilter === "all" || provider.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [search, typeFilter]);

  return (
    <div className="space-y-6">
      <PageHeader title="Insurance Provider Guide">
        <p className="text-sm text-gray-500">
          Major insurance providers covering ABA therapy.
        </p>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "providers", label: "Insurance Providers" },
          { key: "cpt", label: "ABA CPT Codes" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() =>
              setActiveTab(tab.key as "providers" | "cpt")
            }
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
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search providers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            <div className="flex rounded-lg border border-gray-200 p-1">
              {(["all", "commercial", "government"] as const).map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                      typeFilter === type
                        ? "bg-blue-600 text-white"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {type}
                  </button>
                )
              )}
            </div>

            <span className="text-sm text-gray-400">
              {filteredProviders.length} providers
            </span>
          </div>

          {/* Provider Cards */}
          <div className="space-y-4">
            {filteredProviders.map((provider) => {
              const isExpanded =
                expandedProvider === provider.name;

              return (
                <div
                  key={provider.name}
                  className="rounded-2xl border border-gray-100 bg-white shadow-sm"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-800">
                            {provider.name}
                          </h3>

                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              provider.type === "commercial"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {provider.type}
                          </span>

                          {provider.abaCoverage && (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                              Covers ABA
                            </span>
                          )}

                          {provider.requiresAuth && (
                            <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                              Authorization Required
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-500">
                          {provider.notes}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          setExpandedProvider(
                            isExpanded ? null : provider.name
                          )
                        }
                        className="text-sm text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? "Hide" : "View"}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-5 space-y-5 border-t border-gray-100 pt-5">
                        <div>
                          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Authorization Process
                          </h4>

                          <p className="text-sm text-gray-700">
                            {provider.authProcess}
                          </p>
                        </div>

                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Covered CPT Codes
                          </h4>

                          <div className="flex flex-wrap gap-2">
                            {provider.cptCodes.map((code) => (
                              <div
                                key={code}
                                className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2"
                              >
                                <p className="text-sm font-bold text-blue-700">
                                  {code}
                                </p>

                                <p className="text-xs text-blue-600">
                                  {CPT_CODES[code].description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <a
                            href={provider.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                          >
                            Visit Website
                          </a>

                          <a
                            href={`tel:${provider.phone.replace(
                              /[^0-9]/g,
                              ""
                            )}`}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                          >
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
        <Section title="ABA CPT Code Reference">
          <p className="mb-5 text-sm text-gray-500">
            Standard CPT codes commonly used for ABA billing.
          </p>

          <div className="space-y-4">
            {Object.entries(CPT_CODES).map(([code, info]) => (
              <div
                key={code}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-bold text-blue-700">
                      {code}
                    </p>

                    <p className="text-sm text-gray-700">
                      {info.description}
                    </p>
                  </div>

                  <div className="text-right text-xs text-gray-500">
                    <p>15-minute units</p>
                    <p>{info.maxUnits}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs text-gray-500">
                    Provider Type: {info.provider}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-gray-400">
            Always verify payer-specific rules, rates, and authorization
            requirements before billing.
          </p>
        </Section>
      )}
    </div>
  );
}