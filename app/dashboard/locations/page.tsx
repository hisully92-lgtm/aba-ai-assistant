"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { usePlanGate } from "@/lib/hooks/usePlanGate";
import UpgradePrompt from "@/components/ui/UpgradePrompt";
import Link from "next/link";

type Location = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  created_at: string;
};

const emptyForm = {
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  email: "",
  is_primary: false,
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { canAddLocation, locationCount, limits, planName } = usePlanGate();
  const locationGate = canAddLocation();

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const cid = companyUser?.company_id ?? null;
    setCompanyId(cid);

    if (cid) {
      const { data } = await supabase
        .from("locations")
        .select("*")
        .eq("company_id", cid)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      setLocations(data ?? []);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Location name is required."); return; }
    if (!companyId) return;
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    if (editingId) {
      const { data } = await supabase.from("locations").update({
        name: form.name.trim(),
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        phone: form.phone || null,
        email: form.email || null,
        is_primary: form.is_primary,
      }).eq("id", editingId).select().single();

      if (data) {
        setLocations(prev => prev.map(l => l.id === editingId ? data : l));
      }
    } else {
      if (form.is_primary) {
        await supabase.from("locations").update({ is_primary: false }).eq("company_id", companyId);
      }

      const { data } = await supabase.from("locations").insert({
        company_id: companyId,
        name: form.name.trim(),
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        phone: form.phone || null,
        email: form.email || null,
        is_primary: form.is_primary || locations.length === 0,
        created_by: user.id,
      }).select().single();

      if (data) setLocations(prev => [...prev, data]);
    }

    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const loc = locations.find(l => l.id === id);
    if (loc?.is_primary && locations.length > 1) {
      alert("Cannot delete the primary location. Set another location as primary first.");
      return;
    }
    await supabase.from("locations").delete().eq("id", id);
    setLocations(prev => prev.filter(l => l.id !== id));
  }

  async function setPrimary(id: string) {
    if (!companyId) return;
    await supabase.from("locations").update({ is_primary: false }).eq("company_id", companyId);
    await supabase.from("locations").update({ is_primary: true }).eq("id", id);
    setLocations(prev => prev.map(l => ({ ...l, is_primary: l.id === id })));
  }

  function startEdit(loc: Location) {
    setForm({
      name: loc.name,
      address: loc.address ?? "",
      city: loc.city ?? "",
      state: loc.state ?? "",
      zip: loc.zip ?? "",
      phone: loc.phone ?? "",
      email: loc.email ?? "",
      is_primary: loc.is_primary,
    });
    setEditingId(loc.id);
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Locations">
        {locationGate.allowed ? (
          <Button onClick={() => { setShowForm(s => !s); setEditingId(null); setForm(emptyForm); }}>
            {showForm && !editingId ? "Cancel" : "+ Add Location"}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-orange-600 font-medium">
              {locationCount}/{limits.locations} locations
            </span>
            <Link href="/dashboard/settings/billing"
              className="text-xs bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition-colors font-medium">
              Upgrade
            </Link>
          </div>
        )}
      </PageHeader>

      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm">
        <span className="text-gray-600">
          {planName} plan - <strong>{locationCount}</strong> of <strong>{limits.locations === 9999 ? "unlimited" : limits.locations}</strong> locations used
        </span>
        <Link href="/dashboard/settings/billing" className="text-blue-600 hover:underline text-xs">
          Manage Plan
        </Link>
      </div>

      {!locationGate.allowed && (
        <UpgradePrompt
          reason={locationGate.reason!}
          upgradeTo={locationGate.upgradeTo}
          feature="Adding more locations"
        />
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Location saved successfully.
        </div>
      )}

      {showForm && (locationGate.allowed || editingId) && (
        <Section title={editingId ? "Edit Location" : "Add New Location"}>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Location Name *</label>
              <input type="text" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Main Office, North Campus, Home Health"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Street Address</label>
              <input type="text" value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="123 Main Street"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">City</label>
              <input type="text" value={form.city}
                onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">State</label>
                <input type="text" value={form.state}
                  onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
                  placeholder="VA"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">ZIP</label>
                <input type="text" value={form.zip}
                  onChange={e => setForm(p => ({ ...p, zip: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Phone</label>
              <input type="tel" value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="(540) 000-0000"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
              <input type="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="location@clinic.com"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_primary}
                  onChange={e => setForm(p => ({ ...p, is_primary: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600" />
                <span className="text-sm text-gray-700">Set as primary location</span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>
              {editingId ? "Save Changes" : "Add Location"}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>
              Cancel
            </Button>
          </div>
        </Section>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading locations...</p>}

      {!loading && locations.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl bg-white">
          <p className="text-gray-700 font-semibold text-lg">No locations yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-6">Add your clinic locations to manage where sessions take place.</p>
          <Button onClick={() => setShowForm(true)}>+ Add First Location</Button>
        </div>
      )}

      <div className="space-y-3">
        {locations.map(loc => (
          <div key={loc.id} className={"border rounded-xl p-5 bg-white " + (loc.is_primary ? "border-blue-200" : "border-gray-100")}>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-800">{loc.name}</p>
                  {loc.is_primary && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Primary</span>
                  )}
                </div>
                {(loc.address || loc.city) && (
                  <p className="text-sm text-gray-500">
                    {[loc.address, loc.city, loc.state, loc.zip].filter(Boolean).join(", ")}
                  </p>
                )}
                <div className="flex gap-4 mt-1 text-xs text-gray-400 flex-wrap">
                  {loc.phone && <span>{loc.phone}</span>}
                  {loc.email && <span>{loc.email}</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {!loc.is_primary && (
                  <button onClick={() => setPrimary(loc.id)}
                    className="text-xs px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                    Set Primary
                  </button>
                )}
                <button onClick={() => startEdit(loc)}
                  className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                  Edit
                </button>
                <button onClick={() => handleDelete(loc.id)}
                  className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!locationGate.allowed && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
          Need more locations? You can add extra locations for <strong>+$49/mo per location</strong> beyond your plan limit,
          or <Link href="/dashboard/settings/billing" className="underline font-medium">upgrade your plan</Link> for higher limits.
        </div>
      )}
    </div>
  );
}
