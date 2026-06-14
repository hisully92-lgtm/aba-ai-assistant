"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

type AvailableClient = {
  id: string;
  initials: string;
  city: string;
  state: string;
  available_hours: string;
  available_days: string;
  summary: string;
  bcba_name: string | null;
  insurance: string | null;
  age_range: string | null;
  created_at: string;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AvailableClientsPage() {
  const [clients, setClients] = useState<AvailableClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBCBA, setIsBCBA] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterDay, setFilterDay] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [companyId, setCompanyId] = useState("");

  // Form state
  const [initials, setInitials] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [availableHours, setAvailableHours] = useState("");
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [bcbaName, setBcbaName] = useState("");
  const [insurance, setInsurance] = useState("");
  const [ageRange, setAgeRange] = useState("");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const role = companyUser?.role ?? "";
    setCompanyId(companyUser?.company_id ?? "");
    setIsAdmin(["admin", "clinical_director", "director"].includes(role));
    setIsBCBA(["bcba", "supervisor"].includes(role));

    const { data } = await supabase
      .from("available_clients")
      .select("*")
      .eq("company_id", companyUser?.company_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setClients(data ?? []);
    setLoading(false);
  }

  function toggleDay(day: string) {
    setAvailableDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  async function handleSave() {
    if (!initials.trim() || !city.trim() || !summary.trim()) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    await supabase.from("available_clients").insert({
      company_id: companyId,
      initials: initials.trim().toUpperCase(),
      city: city.trim(),
      state: state.trim(),
      available_hours: availableHours.trim(),
      available_days: availableDays.join(", "),
      summary: summary.trim(),
      bcba_name: bcbaName.trim() || null,
      insurance: insurance.trim() || null,
      age_range: ageRange.trim() || null,
      is_active: true,
      created_by: user.id,
    });

    setInitials(""); setCity(""); setState(""); setAvailableHours("");
    setAvailableDays([]); setSummary(""); setBcbaName(""); setInsurance(""); setAgeRange("");
    setShowForm(false);
    await init();
    setSaving(false);
  }

  async function handleDeactivate(id: string) {
    await supabase.from("available_clients").update({ is_active: false }).eq("id", id);
    setClients(prev => prev.filter(c => c.id !== id));
  }

  const filtered = clients
    .filter(c => filterDay ? c.available_days?.includes(filterDay) : true)
    .filter(c => filterCity ? c.city.toLowerCase().includes(filterCity.toLowerCase()) : true);

  return (
    <div className="space-y-6">
      <PageHeader title="Available Clients">
        {(isAdmin || isBCBA) && (
          <button
            onClick={() => setShowForm(s => !s)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            {showForm ? "Cancel" : "+ Post Available Client"}
          </button>
        )}
      </PageHeader>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
        👥 Available clients are posted by BCBAs and admins. Only initials and general location are shown to protect client privacy. Staff interested in taking on a client should contact their supervisor directly.
      </div>

      {showForm && (isAdmin || isBCBA) && (
        <Section title="Post Available Client">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client Initials * (e.g. J.S.)</label>
              <input type="text" value={initials} onChange={e => setInitials(e.target.value)}
                placeholder="J.S." maxLength={10}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <p className="text-xs text-gray-400 mt-1">Use initials only — no full names per HIPAA</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Age Range</label>
              <input type="text" value={ageRange} onChange={e => setAgeRange(e.target.value)}
                placeholder="e.g. 4-6 years"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">City *</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)}
                placeholder="City"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">State</label>
              <input type="text" value={state} onChange={e => setState(e.target.value)}
                placeholder="State" maxLength={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Available Hours</label>
              <input type="text" value={availableHours} onChange={e => setAvailableHours(e.target.value)}
                placeholder="e.g. 20 hrs/week, 9am-3pm"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Insurance</label>
              <input type="text" value={insurance} onChange={e => setInsurance(e.target.value)}
                placeholder="e.g. Medicaid, Blue Cross"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">BCBA on Case</label>
              <input type="text" value={bcbaName} onChange={e => setBcbaName(e.target.value)}
                placeholder="BCBA first name only"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Available Days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(day => (
                  <button key={day} type="button" onClick={() => toggleDay(day)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${availableDays.includes(day) ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Summary * (what the child will work on)</label>
              <textarea value={summary} onChange={e => setSummary(e.target.value)}
                placeholder="Brief summary of goals and programs (no identifying information)..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} disabled={saving || !initials || !city || !summary}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Posting..." : "Post Client"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </Section>
      )}

      {/* FILTERS */}
      <div className="flex gap-3 flex-wrap items-center">
        <select value={filterDay} onChange={e => setFilterDay(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Days</option>
          {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <input type="text" value={filterCity} onChange={e => setFilterCity(e.target.value)}
          placeholder="Filter by city..."
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        {(filterDay || filterCity) && (
          <button onClick={() => { setFilterDay(""); setFilterCity(""); }}
            className="text-xs text-blue-500 hover:underline">Clear filters</button>
        )}
        <p className="text-sm text-gray-400">{filtered.length} available</p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-gray-600 font-medium">No available clients posted</p>
          <p className="text-gray-400 text-sm mt-1">
            {isAdmin || isBCBA ? "Post an available client to help your team fill their caseloads." : "Check back later — your admin or BCBA will post available clients here."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(client => (
          <div key={client.id} className="border border-gray-100 rounded-2xl p-5 bg-white hover:border-blue-200 hover:shadow-sm transition-all">
            <div className="flex justify-between items-start mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-700 font-bold text-sm">{client.initials}</span>
              </div>
              <div className="text-right">
                {client.age_range && (
                  <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-full">{client.age_range}</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>📍</span>
                <span>{client.city}{client.state ? `, ${client.state}` : ""}</span>
              </div>
              {client.available_hours && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>⏰</span>
                  <span>{client.available_hours}</span>
                </div>
              )}
              {client.available_days && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>📅</span>
                  <span>{client.available_days}</span>
                </div>
              )}
              {client.insurance && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>🏦</span>
                  <span>{client.insurance}</span>
                </div>
              )}
              {client.bcba_name && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>👩‍⚕️</span>
                  <span>BCBA: {client.bcba_name}</span>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50 leading-relaxed">
                {client.summary}
              </p>
            </div>
            {(isAdmin || isBCBA) && (
              <button onClick={() => handleDeactivate(client.id)}
                className="mt-3 text-xs text-gray-300 hover:text-red-400 transition-colors">
                Remove listing
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}