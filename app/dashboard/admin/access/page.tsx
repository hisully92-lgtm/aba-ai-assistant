"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type FeatureAccess = {
  id?: string;
  feature_key: string;
  feature_label: string;
  feature_category: string;
  roles_with_access: string[];
  is_enabled: boolean;
};

const ROLES = ["admin", "director", "supervisor", "bcba", "clinician", "rbt", "bt", "student_analyst"];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  director: "Director",
  supervisor: "Supervisor",
  bcba: "BCBA",
  clinician: "Clinician",
  rbt: "RBT",
  bt: "BT",
  student_analyst: "Student Analyst",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  director: "bg-purple-100 text-purple-700 border-purple-200",
  supervisor: "bg-blue-100 text-blue-700 border-blue-200",
  bcba: "bg-green-100 text-green-700 border-green-200",
  clinician: "bg-teal-100 text-teal-700 border-teal-200",
  rbt: "bg-yellow-100 text-yellow-700 border-yellow-200",
  bt: "bg-orange-100 text-orange-700 border-orange-200",
  student_analyst: "bg-gray-100 text-gray-700 border-gray-200",
};

// All features that can be controlled
const DEFAULT_FEATURES: Omit<FeatureAccess, "id">[] = [
  // Session Notes
  { feature_key: "session_notes", feature_label: "Session Notes", feature_category: "Session Notes", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "session_templates", feature_label: "Session Templates", feature_category: "Session Notes", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "data_collection", feature_label: "Data Collection Hub", feature_category: "Session Notes", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "session_errors", feature_label: "Session Error Log", feature_category: "Session Notes", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  // Behavior
  { feature_key: "behaviors", feature_label: "Behavior Interventions", feature_category: "Behavior", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "behavior_log", feature_label: "Behavior Log", feature_category: "Behavior", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "bip_plans", feature_label: "BIP Plans", feature_category: "Behavior", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  { feature_key: "crisis_plans", feature_label: "Crisis Plans", feature_category: "Behavior", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "interval_recording", feature_label: "Interval Recording", feature_category: "Behavior", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "rate_data", feature_label: "Rate Data", feature_category: "Behavior", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  // Programs
  { feature_key: "programs", feature_label: "Skill Programs", feature_category: "Programs", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "dtt", feature_label: "DTT Data Collection", feature_category: "Programs", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "prompt_fading", feature_label: "Prompt Fading", feature_category: "Programs", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "task_analysis", feature_label: "Task Analysis", feature_category: "Programs", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "program_books", feature_label: "Program Books", feature_category: "Programs", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  // Clients
  { feature_key: "clients", feature_label: "Client List", feature_category: "Clients", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "client_intake", feature_label: "Client Intake", feature_category: "Clients", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  { feature_key: "assessments", feature_label: "Assessments", feature_category: "Clients", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  { feature_key: "goals", feature_label: "Goals Dashboard", feature_category: "Clients", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "treatment_plans", feature_label: "Treatment Plans", feature_category: "Clients", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  { feature_key: "discharge", feature_label: "Discharge Planning", feature_category: "Clients", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  { feature_key: "authorizations", feature_label: "Authorizations", feature_category: "Clients", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  { feature_key: "waitlist", feature_label: "Waitlist", feature_category: "Clients", roles_with_access: ["admin","director","supervisor","bcba"], is_enabled: true },
  // Schedule
  { feature_key: "schedule", feature_label: "Schedule / Calendar", feature_category: "Schedule", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "signatures", feature_label: "Signatures", feature_category: "Schedule", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "timetracking", feature_label: "Time Tracking", feature_category: "Schedule", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "telehealth", feature_label: "Telehealth", feature_category: "Schedule", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "geofence", feature_label: "Geofence / Clock In", feature_category: "Schedule", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  // Billing
  { feature_key: "insurance", feature_label: "Insurance & Claims", feature_category: "Billing", roles_with_access: ["admin","director","supervisor","bcba"], is_enabled: true },
  { feature_key: "era_eob", feature_label: "ERA / EOB Posting", feature_category: "Billing", roles_with_access: ["admin","director"], is_enabled: true },
  { feature_key: "cms1500", feature_label: "CMS-1500 Claims", feature_category: "Billing", roles_with_access: ["admin","director","supervisor"], is_enabled: true },
  { feature_key: "copay", feature_label: "Co-pay Tracking", feature_category: "Billing", roles_with_access: ["admin","director","supervisor","bcba"], is_enabled: true },
  { feature_key: "superbills", feature_label: "Superbills", feature_category: "Billing", roles_with_access: ["admin","director","supervisor"], is_enabled: true },
  { feature_key: "payroll", feature_label: "Payroll Logs", feature_category: "Billing", roles_with_access: ["admin","director"], is_enabled: true },
  // Team
  { feature_key: "team", feature_label: "Team Members", feature_category: "Team", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  { feature_key: "supervision", feature_label: "Supervision Logs", feature_category: "Team", roles_with_access: ["admin","director","supervisor","bcba","student_analyst"], is_enabled: true },
  { feature_key: "competency", feature_label: "Competency Checks", feature_category: "Team", roles_with_access: ["admin","director","supervisor","bcba"], is_enabled: true },
  { feature_key: "staff_performance", feature_label: "Staff Performance", feature_category: "Team", roles_with_access: ["admin","director","supervisor"], is_enabled: true },
  { feature_key: "time_off", feature_label: "Time Off Requests", feature_category: "Team", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "accounting", feature_label: "Accounting", feature_category: "Team", roles_with_access: ["admin","director"], is_enabled: true },
  // Clinical
  { feature_key: "progress_reports", feature_label: "Progress Reports", feature_category: "Clinical", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  { feature_key: "incidents", feature_label: "Incident Reports", feature_category: "Clinical", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "caregiver_training", feature_label: "Caregiver Training", feature_category: "Clinical", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  { feature_key: "fidelity", feature_label: "Program Fidelity", feature_category: "Clinical", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  { feature_key: "preference_assessment", feature_label: "Preference Assessments", feature_category: "Clinical", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "social_stories", feature_label: "Social Stories", feature_category: "Clinical", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  { feature_key: "visual_supports", feature_label: "Visual Supports", feature_category: "Clinical", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "safmeds", feature_label: "SAFMEDS", feature_category: "Clinical", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt","student_analyst"], is_enabled: true },
  { feature_key: "rbt_checklist", feature_label: "RBT Daily Checklist", feature_category: "Clinical", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "ai_treatment_plans", feature_label: "AI Treatment Plans", feature_category: "Clinical", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  // Analytics
  { feature_key: "analytics_graphs", feature_label: "ABA Graphs", feature_category: "Analytics", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "analytics_heatmap", feature_label: "Behavior Heatmap", feature_category: "Analytics", roles_with_access: ["admin","director","supervisor","bcba","clinician"], is_enabled: true },
  { feature_key: "analytics_macro", feature_label: "Macro Trends", feature_category: "Analytics", roles_with_access: ["admin","director","supervisor"], is_enabled: true },
  // Communication
  { feature_key: "parent_portal", feature_label: "Parent Portal", feature_category: "Communication", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt"], is_enabled: true },
  { feature_key: "direct_messages", feature_label: "Direct Messages", feature_category: "Communication", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt","student_analyst"], is_enabled: true },
  { feature_key: "notifications", feature_label: "Notifications", feature_category: "Communication", roles_with_access: ["admin","director","supervisor","bcba","clinician","rbt","bt","student_analyst"], is_enabled: true },
  // Admin
  { feature_key: "admin_panel", feature_label: "Admin Panel", feature_category: "Admin", roles_with_access: ["admin","director","developer"], is_enabled: true },
  { feature_key: "feature_access", feature_label: "Feature Access Control", feature_category: "Admin", roles_with_access: ["admin","director","developer"], is_enabled: true },
  { feature_key: "locations", feature_label: "Location Management", feature_category: "Admin", roles_with_access: ["admin","director","developer"], is_enabled: true },
  { feature_key: "audit_logs", feature_label: "Audit Logs", feature_category: "Admin", roles_with_access: ["admin","director","developer"], is_enabled: true },
];

export default function FeatureAccessPage() {
  const [features, setFeatures] = useState<FeatureAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [unsaved, setUnsaved] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) return;
    setCompanyId(profile.company_id);

    const { data: existingFeatures } = await supabase
      .from("feature_access")
      .select("*")
      .eq("company_id", profile.company_id);

    // Merge defaults with any saved overrides
    const merged = DEFAULT_FEATURES.map((def) => {
      const saved = existingFeatures?.find((f) => f.feature_key === def.feature_key);
      return saved ? {
        ...def,
        id: saved.id,
        roles_with_access: saved.roles_with_access ?? def.roles_with_access,
        is_enabled: saved.is_enabled ?? def.is_enabled,
      } : def;
    });

    setFeatures(merged);
    setLoading(false);
  }

  function toggleRole(featureKey: string, role: string) {
    setFeatures((prev) => prev.map((f) => {
      if (f.feature_key !== featureKey) return f;
      const has = f.roles_with_access.includes(role);
      return {
        ...f,
        roles_with_access: has
          ? f.roles_with_access.filter((r) => r !== role)
          : [...f.roles_with_access, role],
      };
    }));
    setUnsaved(true);
  }

  function toggleEnabled(featureKey: string) {
    setFeatures((prev) => prev.map((f) =>
      f.feature_key === featureKey ? { ...f, is_enabled: !f.is_enabled } : f
    ));
    setUnsaved(true);
  }

  function setAllRoles(featureKey: string, roles: string[]) {
    setFeatures((prev) => prev.map((f) =>
      f.feature_key === featureKey ? { ...f, roles_with_access: roles } : f
    ));
    setUnsaved(true);
  }

  async function saveAll() {
    if (!companyId) return;
    setSaving("all");

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    for (const feature of features) {
      await supabase.from("feature_access").upsert({
        company_id: companyId,
        feature_key: feature.feature_key,
        feature_label: feature.feature_label,
        feature_category: feature.feature_category,
        roles_with_access: feature.roles_with_access,
        is_enabled: feature.is_enabled,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "company_id,feature_key" });
    }

    setUnsaved(false);
    setSaving(null);
  }

  async function resetToDefaults() {
    setFeatures(DEFAULT_FEATURES.map((f) => ({ ...f })));
    setUnsaved(true);
  }

  const categories = ["all", ...new Set(DEFAULT_FEATURES.map((f) => f.feature_category))];

  let filtered = features;
  if (filterCategory !== "all") filtered = filtered.filter((f) => f.feature_category === filterCategory);
  if (filterRole !== "all") filtered = filtered.filter((f) => f.roles_with_access.includes(filterRole));

  const groupedByCategory = filtered.reduce((acc, f) => {
    acc[f.feature_category] = acc[f.feature_category] ?? [];
    acc[f.feature_category].push(f);
    return acc;
  }, {} as Record<string, FeatureAccess[]>);

  return (
    <div className="space-y-6">
      <PageHeader title="Feature Access Control">
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefaults}>Reset Defaults</Button>
          <Button onClick={saveAll} loading={saving === "all"} disabled={!unsaved}>
            {unsaved ? "💾 Save Changes" : "✓ Saved"}
          </Button>
        </div>
      </PageHeader>

      {/* INFO */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-bold mb-1">🔐 Role-Based Feature Access</p>
        <p className="text-xs">Control which roles can see and access each feature. Changes apply immediately after saving.
        Admin, Director, and Developer always retain access to this page regardless of settings.</p>
      </div>

      {/* UNSAVED BANNER */}
      {unsaved && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm text-orange-700 font-medium">⚠️ You have unsaved changes</p>
          <Button onClick={saveAll} loading={saving === "all"}>Save Now</Button>
        </div>
      )}

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3 items-center">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Category</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            {categories.map((c) => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Filter by Role</label>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="all">All Roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div className="text-sm text-gray-400 mt-4">{filtered.length} features</div>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {/* ROLE LEGEND */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map((role) => (
          <span key={role} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${ROLE_COLORS[role]}`}>
            {ROLE_LABELS[role]}
          </span>
        ))}
      </div>

      {/* FEATURES BY CATEGORY */}
      {Object.entries(groupedByCategory).map(([category, categoryFeatures]) => (
        <Section key={category} title={category}>
          <div className="space-y-3">
            {/* HEADER ROW */}
            <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide px-3">
              <div className="col-span-3">Feature</div>
              <div className="col-span-1 text-center">Enabled</div>
              <div className="col-span-6">Role Access</div>
              <div className="col-span-2 text-right">Quick Set</div>
            </div>

            {categoryFeatures.map((feature) => (
              <div key={feature.feature_key}
                className={`border rounded-xl p-3 transition-all ${!feature.is_enabled ? "bg-gray-50 border-gray-100 opacity-60" : "bg-white border-gray-100"}`}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">

                  {/* FEATURE NAME */}
                  <div className="md:col-span-3">
                    <p className="font-medium text-gray-800 text-sm">{feature.feature_label}</p>
                    <p className="text-xs text-gray-400">{feature.feature_key}</p>
                  </div>

                  {/* ENABLED TOGGLE */}
                  <div className="md:col-span-1 flex md:justify-center">
                    <button
                      onClick={() => toggleEnabled(feature.feature_key)}
                      className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${feature.is_enabled ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${feature.is_enabled ? "left-6" : "left-1"}`} />
                    </button>
                  </div>

                  {/* ROLE TOGGLES */}
                  <div className="md:col-span-6 flex flex-wrap gap-1.5">
                    {ROLES.map((role) => {
                      const hasAccess = feature.roles_with_access.includes(role);
                      return (
                        <button
                          key={role}
                          onClick={() => toggleRole(feature.feature_key, role)}
                          disabled={!feature.is_enabled}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                            hasAccess && feature.is_enabled
                              ? ROLE_COLORS[role]
                              : "border-gray-200 text-gray-300 bg-white"
                          }`}
                        >
                          {ROLE_LABELS[role]}
                        </button>
                      );
                    })}
                  </div>

                  {/* QUICK SET */}
                  <div className="md:col-span-2 flex gap-1 justify-end">
                    <button
                      onClick={() => setAllRoles(feature.feature_key, ROLES)}
                      className="text-xs px-2 py-1 border border-green-200 text-green-600 rounded hover:bg-green-50"
                      title="Grant all roles"
                    >All</button>
                    <button
                      onClick={() => setAllRoles(feature.feature_key, ["admin","director","developer"])}
                      className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50"
                      title="Admin only"
                    >Admin</button>
                    <button
                      onClick={() => setAllRoles(feature.feature_key, [])}
                      className="text-xs px-2 py-1 border border-gray-200 text-gray-400 rounded hover:bg-gray-50"
                      title="Revoke all access"
                    >None</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ))}

      {/* SAVE FOOTER */}
      {unsaved && (
        <div className="sticky bottom-4 flex justify-center">
          <div className="bg-gray-900 text-white rounded-2xl px-6 py-3 flex items-center gap-4 shadow-xl">
            <p className="text-sm">You have unsaved changes</p>
            <Button onClick={saveAll} loading={saving === "all"} className="bg-blue-500 hover:bg-blue-600">
              💾 Save All Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}