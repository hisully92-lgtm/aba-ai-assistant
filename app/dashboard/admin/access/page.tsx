"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";

const ROLES = ["clinician", "bt", "supervisor", "student_analyst", "parent"];

const SECTIONS = [
  {
    key: "session_notes",
    label: "Session Notes",
    icon: "📋",
    children: [
      { key: "data_collection", label: "Data Collection Hub" },
      { key: "new_session", label: "New Session" },
      { key: "recent_sessions", label: "Recent Sessions" },
      { key: "session_error_log", label: "Session Error Log" },
      { key: "session_templates", label: "Session Templates" },
    ],
  },
  {
    key: "behavior_interventions",
    label: "Behavior Interventions",
    icon: "🧠",
    children: [
      { key: "abc_data", label: "ABC Data" },
      { key: "active_interventions", label: "Active Interventions" },
      { key: "behavior_log", label: "Behavior Log" },
      { key: "intervention_history", label: "Intervention History" },
      { key: "interval_recording", label: "Interval Recording" },
      { key: "rate_data", label: "Rate Data" },
      { key: "visual_analytics", label: "Visual Analytics" },
    ],
  },
  {
    key: "skill_programs",
    label: "Skill Programs",
    icon: "🎯",
    children: [
      { key: "active_programs", label: "Active Programs" },
      { key: "add_program", label: "Add Program" },
      { key: "dtt_data", label: "DTT Data Collection" },
      { key: "program_books", label: "Program Books" },
      { key: "program_fidelity", label: "Program Fidelity" },
      { key: "program_progress", label: "Program Progress" },
    ],
  },
  {
    key: "clients",
    label: "Clients / Learners",
    icon: "👥",
    children: [
      { key: "add_client", label: "Add Client" },
      { key: "all_clients", label: "All Clients" },
      { key: "assessments", label: "Assessments" },
      { key: "authorizations", label: "Authorizations" },
      { key: "bip_plans", label: "BIP Plans" },
      { key: "client_intake", label: "Client Intake" },
      { key: "crisis_plans", label: "Crisis Plans" },
      { key: "discharge_planning", label: "Discharge Planning" },
      { key: "goals_dashboard", label: "Goals Dashboard" },
      { key: "treatment_plans", label: "Treatment Plans" },
      { key: "waitlist", label: "Waitlist" },
    ],
  },
  {
    key: "schedule",
    label: "Schedule",
    icon: "📅",
    children: [
      { key: "calendar_view", label: "Calendar View" },
      { key: "geofence", label: "Geofence" },
      { key: "reminders", label: "Reminders" },
      { key: "schedule_conflicts", label: "Schedule Conflicts" },
      { key: "session_changes", label: "Session Changes" },
      { key: "session_recordings", label: "Session Recordings" },
      { key: "signatures", label: "Signatures" },
      { key: "telehealth", label: "Telehealth" },
      { key: "time_tracking", label: "Time Tracking" },
      { key: "waiting_room", label: "Waiting Room" },
    ],
  },
  {
    key: "insurance_billing",
    label: "Insurance & Billing",
    icon: "🏦",
    children: [
      { key: "ai_compliance", label: "AI Compliance Check" },
      { key: "claims_auth", label: "Claims & Auth" },
      { key: "cms1500", label: "CMS-1500 Claims" },
      { key: "copay_tracking", label: "Co-pay Tracking" },
      { key: "eligibility", label: "Eligibility Verification" },
      { key: "era_eob", label: "ERA / EOB Posting" },
      { key: "insurance_providers", label: "Insurance Providers" },
      { key: "payroll_logs", label: "Payroll Logs" },
      { key: "revenue_cycle", label: "Revenue Cycle" },
      { key: "superbills", label: "Superbills" },
    ],
  },
  {
    key: "team",
    label: "Team",
    icon: "🏢",
    children: [
      { key: "accounting", label: "Accounting" },
      { key: "competency_checks", label: "Competency Checks" },
      { key: "locations", label: "Locations" },
      { key: "staff_performance", label: "Staff Performance" },
      { key: "supervision_logs", label: "Supervision Logs" },
      { key: "time_off_requests", label: "Time Off Requests" },
    ],
  },
  {
    key: "communication",
    label: "Communication",
    icon: "💬",
    children: [
      { key: "ai_parent_summary", label: "AI Parent Summary" },
      { key: "caregiver_training", label: "Caregiver Training" },
      { key: "direct_messages", label: "Direct Messages" },
      { key: "home_program_data", label: "Home Program Data" },
      { key: "notifications", label: "Notifications" },
      { key: "parent_documents", label: "Parent Documents" },
      { key: "parent_portal", label: "Parent Portal" },
      { key: "team_chat", label: "Team Chat" },
    ],
  },
  {
    key: "clinical",
    label: "Clinical",
    icon: "🏥",
    children: [
      { key: "ai_assistant", label: "AI Assistant" },
      { key: "ai_treatment_plans", label: "AI Treatment Plans" },
      { key: "clinician_view", label: "Clinician View" },
      { key: "incident_reports", label: "Incident Reports" },
      { key: "preference_assessment", label: "Preference Assessment" },
      { key: "progress_reports", label: "Progress Reports" },
      { key: "prompt_fading", label: "Prompt Fading" },
      { key: "rbt_checklist", label: "RBT Checklist" },
      { key: "report_templates", label: "Report Templates" },
      { key: "safmeds", label: "SAFMEDS" },
      { key: "social_stories", label: "Social Stories" },
      { key: "suggestions", label: "Suggestions" },
      { key: "task_analysis", label: "Task Analysis" },
      { key: "training_library", label: "Training Library" },
      { key: "visual_supports", label: "Visual Supports" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: "📈",
    children: [
      { key: "aba_graphs", label: "ABA Graphs" },
      { key: "behavior_heatmap", label: "Behavior Heatmap" },
      { key: "macro_trends", label: "Macro Trends" },
    ],
  },
  {
    key: "history",
    label: "History",
    icon: "📁",
    children: [
      { key: "ai_request_history", label: "AI Request History" },
      { key: "export_history", label: "Export History" },
      { key: "progress_reports_history", label: "Progress Reports" },
      { key: "session_history", label: "Session History" },
    ],
  },
  {
    key: "settings",
    label: "Profile / Settings",
    icon: "⚙️",
    children: [
      { key: "rbt_course", label: "40-Hour RBT Course" },
      { key: "my_availability", label: "My Availability" },
      { key: "my_credentials", label: "My Credentials" },
      { key: "my_profile", label: "My Profile" },
      { key: "notifications_settings", label: "Notifications" },
      { key: "plan_billing", label: "Plan & Billing" },
      { key: "security", label: "Security" },
      { key: "sms_alerts", label: "SMS Alerts" },
      { key: "training_certificate", label: "Training Certificate" },
    ],
  },
];

type AccessMap = Record<string, Record<string, boolean>>;

export default function FeatureAccessPage() {
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [accessMap, setAccessMap] = useState<AccessMap>({});
  const [activeRole, setActiveRole] = useState(ROLES[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  useEffect(() => { void init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: cu } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!cu || !["admin", "director", "clinical_director"].includes(cu.role ?? "")) {
      window.location.href = "/dashboard";
      return;
    }

    const { data: companyData } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", cu.company_id)
      .single();
    setCompany(companyData);

    const { data: accessData } = await supabase
      .from("feature_access")
      .select("role, feature_key, enabled")
      .eq("company_id", cu.company_id);

    // Build access map — default everything to true
    const map: AccessMap = {};
    for (const role of ROLES) {
      map[role] = {};
      for (const section of SECTIONS) {
        map[role][section.key] = true;
        for (const child of section.children) {
          map[role][child.key] = true;
        }
      }
    }

    // Override with saved values
    for (const row of accessData ?? []) {
      if (!map[row.role]) map[row.role] = {};
      map[row.role][row.feature_key] = row.enabled;
    }

    setAccessMap(map);
    setLoading(false);
  }

  function toggle(role: string, key: string) {
    setAccessMap(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [key]: !prev[role]?.[key],
      },
    }));
  }

  function toggleSection(role: string, sectionKey: string, children: { key: string }[]) {
    const allEnabled = children.every(c => accessMap[role]?.[c.key] !== false);
    const newVal = !allEnabled;
    setAccessMap(prev => {
      const updated = { ...prev[role] };
      updated[sectionKey] = newVal;
      for (const child of children) {
        updated[child.key] = newVal;
      }
      return { ...prev, [role]: updated };
    });
  }

  function toggleExpand(key: string) {
    setExpandedSections(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  async function handleSave() {
    if (!company) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const rows: any[] = [];
    for (const role of ROLES) {
      for (const section of SECTIONS) {
        rows.push({
          company_id: company.id,
          role,
          feature_key: section.key,
          enabled: accessMap[role]?.[section.key] ?? true,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        });
        for (const child of section.children) {
          rows.push({
            company_id: company.id,
            role,
            feature_key: child.key,
            enabled: accessMap[role]?.[child.key] ?? true,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    await supabase.from("feature_access").upsert(rows, {
      onConflict: "company_id,role,feature_key",
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function isAllEnabled(role: string) {
    return SECTIONS.every(s =>
      s.children.every(c => accessMap[role]?.[c.key] !== false)
    );
  }

  function enableAll(role: string, enabled: boolean) {
    setAccessMap(prev => {
      const updated = { ...prev[role] };
      for (const section of SECTIONS) {
        updated[section.key] = enabled;
        for (const child of section.children) {
          updated[child.key] = enabled;
        }
      }
      return { ...prev, [role]: updated };
    });
  }

  if (loading) return <div className="p-8 text-gray-400">Loading access settings...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader title="Feature Access Control">
        <p className="text-sm text-gray-500">
          Control which sections and pages each role can see in {company?.name}.
        </p>
      </PageHeader>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ✓ Access settings saved successfully.
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
        <strong>Note:</strong> Admin and Director roles always have full access and cannot be restricted here.
        These settings apply to: Clinician, BT, Supervisor, Student Analyst, and Parent roles.
      </div>

      {/* ROLE TABS */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {ROLES.map(role => (
          <button key={role} onClick={() => setActiveRole(role)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap capitalize ${activeRole === role ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {role.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* ENABLE ALL / DISABLE ALL */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 capitalize font-medium">
          {activeRole.replace("_", " ")} — {Object.values(accessMap[activeRole] ?? {}).filter(Boolean).length} features enabled
        </p>
        <div className="flex gap-2">
          <button onClick={() => enableAll(activeRole, true)}
            className="text-xs px-3 py-1.5 border border-green-300 text-green-600 rounded-lg hover:bg-green-50 transition-colors">
            Enable All
          </button>
          <button onClick={() => enableAll(activeRole, false)}
            className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
            Disable All
          </button>
        </div>
      </div>

      {/* SECTIONS */}
      <div className="space-y-3">
        {SECTIONS.map(section => {
          const allChildrenEnabled = section.children.every(c => accessMap[activeRole]?.[c.key] !== false);
          const someEnabled = section.children.some(c => accessMap[activeRole]?.[c.key] !== false);
          const isExpanded = expandedSections.includes(section.key);

          return (
            <div key={section.key} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              {/* SECTION HEADER */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleExpand(section.key)}
                    className="text-gray-400 hover:text-gray-600 text-xs">
                    {isExpanded ? "▼" : "▶"}
                  </button>
                  <span className="text-base">{section.icon}</span>
                  <span className="font-semibold text-gray-800 text-sm">{section.label}</span>
                  <span className="text-xs text-gray-400">
                    ({section.children.filter(c => accessMap[activeRole]?.[c.key] !== false).length}/{section.children.length} enabled)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {/* SECTION TOGGLE */}
                  <button
                    onClick={() => toggleSection(activeRole, section.key, section.children)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${allChildrenEnabled ? "bg-blue-500" : someEnabled ? "bg-blue-200" : "bg-gray-300"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${allChildrenEnabled ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>

              {/* CHILDREN */}
              {isExpanded && (
                <div className="divide-y divide-gray-50">
                  {section.children.map(child => {
                    const enabled = accessMap[activeRole]?.[child.key] !== false;
                    return (
                      <div key={child.key} className="flex items-center justify-between px-6 py-2.5">
                        <span className={`text-sm ${enabled ? "text-gray-700" : "text-gray-400 line-through"}`}>
                          {child.label}
                        </span>
                        <button
                          onClick={() => toggle(activeRole, child.key)}
                          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${enabled ? "bg-blue-500" : "bg-gray-300"}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-1"}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* SAVE */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 -mx-4 md:-mx-6 lg:-mx-8">
        <div className="flex items-center justify-between max-w-5xl">
          <p className="text-xs text-gray-400">Changes take effect immediately after saving.</p>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {saving ? "Saving..." : "Save Access Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}