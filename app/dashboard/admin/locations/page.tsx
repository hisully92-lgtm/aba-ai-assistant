"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { usePlanGate } from "@/lib/hooks/usePlanGate";
import UpgradePrompt from "@/components/ui/UpgradePrompt";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Location = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  radius: number | null;
  is_active: boolean;
  payment_status: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  email: string | null;
};

type Assignment = {
  user_id: string;
  location_id: string;
  is_primary: boolean;
};

type Addon = {
  id: string;
  company_id: string;
  location_id: string | null;
  addon_type: string;
  status: string;
  monthly_price: number;
  included_units: number;
  overage_rate: number;
};

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const emptyForm = {
  name: "", address: "", city: "", state: "", zip: "",
  phone: "", lat: "", lng: "", radius: "300",
};

// Estimate based on ~45-min average telehealth session, 5-10 sessions/week/staff,
// 3-4 SMS/day/staff, ~4.33 weeks and ~22 business days per month.
// Video: $0.004/participant-minute actual cost, $60/mo base w/ 3,000 min included, $0.025/min overage.
// SMS: ~$0.0125/segment actual cost, $35/mo base w/ 2,000 segments included, $0.02/segment overage.
function estimateAddonCost(staffCount: number) {
  if (staffCount <= 0) return null;

  const videoMinLow = staffCount * 5 * 45 * 4.33;
  const videoMinHigh = staffCount * 10 * 45 * 4.33;
  const videoCostLow = 60 + Math.max(0, videoMinLow - 3000) * 0.025;
  const videoCostHigh = 60 + Math.max(0, videoMinHigh - 3000) * 0.025;

  const smsMsgsLow = staffCount * 3 * 22;
  const smsMsgsHigh = staffCount * 4 * 22;
  const smsCostLow = 35 + Math.max(0, smsMsgsLow - 2000) * 0.02;
  const smsCostHigh = 35 + Math.max(0, smsMsgsHigh - 2000) * 0.02;

  return {
    video: { low: Math.round(videoCostLow), high: Math.round(videoCostHigh) },
    sms: { low: Math.round(smsCostLow), high: Math.round(smsCostHigh) },
  };
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);
  const [editingCoords, setEditingCoords] = useState<string | null>(null);
  const [coordForm, setCoordForm] = useState({ lat: "", lng: "", radius: "300" });
  const [savingCoords, setSavingCoords] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("Unknown");
  const [userId, setUserId] = useState<string | null>(null);
  const { canAddLocation, limits, planName } = usePlanGate();
  const [urlMessage, setUrlMessage] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [requestingAddon, setRequestingAddon] = useState<string | null>(null); // `${locationId}:${addonType}`
  const [addonError, setAddonError] = useState<string | null>(null);
  const [addonMessage, setAddonMessage] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!companyUser?.company_id) return;
    setCompanyId(companyUser.company_id);

    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyUser.company_id)
      .single();
    if (company) setCompanyName(company.name);

    const [{ data: locData }, { data: profileData }, { data: assignData }, { data: addonData }] = await Promise.all([
      supabase.from("locations").select("*").eq("company_id", companyUser.company_id).order("name"),
      supabase.from("profiles").select("id, full_name, role, email"),
      supabase.from("user_location_assignments").select("user_id, location_id, is_primary"),
      supabase.from("company_addons").select("*").eq("company_id", companyUser.company_id).not("location_id", "is", null),
    ]);

    setLocations(locData ?? []);
    setProfiles(profileData ?? []);
    setAssignments(assignData ?? []);
    setAddons(addonData ?? []);
    setLoading(false);
  }

  function handleAddLocationClick() {
    const gate = canAddLocation();
    if (!gate.allowed) return;
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name || !companyId) return;
    setSaving(true);

    const isAdditional = locations.length >= 1;

    const res = await fetch("/api/admin/save-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        name: form.name,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        phone: form.phone || null,
        lat: form.lat || null,
        lng: form.lng || null,
        radius: form.radius || "300",
        createdBy: userId,
        paymentStatus: isAdditional ? "pending" : "not_required",
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      alert("Failed to save location: " + result.error);
      setSaving(false);
      return;
    }

    if (result.data) {
      setLocations(prev => [...prev, result.data]);
      setForm(emptyForm);
      setShowForm(false);
    }

    if (isAdditional) {
      await fetch("/api/request-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          companyName,
          currentPlan: "current",
          requestedPlan: "additional location ($49/mo)",
          resourceType: "location: " + form.name,
        }),
      });
      setRequestSent(true);
    }

    setSaving(false);
  }

  async function saveCoords(locationId: string) {
    setSavingCoords(true);
    const { data } = await supabase.from("locations").update({
      lat: coordForm.lat ? parseFloat(coordForm.lat) : null,
      lng: coordForm.lng ? parseFloat(coordForm.lng) : null,
      radius: coordForm.radius ? parseInt(coordForm.radius) : 300,
    }).eq("id", locationId).select().maybeSingle();
    if (data) setLocations(prev => prev.map(l => l.id === locationId ? data : l));
    setEditingCoords(null);
    setSavingCoords(false);
  }

  async function toggleLocation(id: string, is_active: boolean) {
    await supabase.from("locations").update({ is_active: !is_active }).eq("id", id);
    setLocations(prev => prev.map(l => l.id === id ? { ...l, is_active: !is_active } : l));
  }

  async function deleteLocation(id: string) {
    if (!confirm("Delete this location? This cannot be undone.")) return;
    await supabase.from("locations").delete().eq("id", id);
    setLocations(prev => prev.filter(l => l.id !== id));
  }

  async function toggleAssignment(uid: string, locationId: string) {
    const existing = assignments.find(a => a.user_id === uid && a.location_id === locationId);
    if (existing) {
      await supabase.from("user_location_assignments").delete()
        .eq("user_id", uid).eq("location_id", locationId);
      setAssignments(prev => prev.filter(a => !(a.user_id === uid && a.location_id === locationId)));
    } else {
      const isPrimary = !assignments.find(a => a.user_id === uid);
      const { data } = await supabase.from("user_location_assignments").insert([{
        user_id: uid,
        location_id: locationId,
        is_primary: isPrimary,
      }]).select().maybeSingle();
      if (data) setAssignments(prev => [...prev, data]);
    }
  }

  async function setPrimary(uid: string, locationId: string) {
    await supabase.from("user_location_assignments").update({ is_primary: false }).eq("user_id", uid);
    await supabase.from("user_location_assignments").update({ is_primary: true })
      .eq("user_id", uid).eq("location_id", locationId);
    setAssignments(prev => prev.map(a =>
      a.user_id === uid ? { ...a, is_primary: a.location_id === locationId } : a
    ));
  }

  function isAssigned(uid: string, locationId: string) {
    return assignments.some(a => a.user_id === uid && a.location_id === locationId);
  }

  function isPrimary(uid: string, locationId: string) {
    return assignments.some(a => a.user_id === uid && a.location_id === locationId && a.is_primary);
  }

  function getUsersForLocation(locationId: string) {
    return profiles.filter(p => isAssigned(p.id, locationId));
  }

  function getAddonForLocation(locationId: string, addonType: string): Addon | undefined {
    return addons.find(a => a.location_id === locationId && a.addon_type === addonType);
  }

  async function requestAddon(location: Location, addonType: "telehealth_video" | "sms") {
    if (!companyId) return;
    const key = `${location.id}:${addonType}`;
    setRequestingAddon(key);
    setAddonError(null);
    setAddonMessage(null);

    const res = await fetch("/api/admin/request-addon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        companyName,
        locationId: location.id,
        locationName: location.name,
        addonType,
        requestedBy: userId,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      setAddonError(result.error ?? "Failed to request add-on.");
      setRequestingAddon(null);
      return;
    }

    setAddons(prev => [...prev, result.addon]);
    setAddonMessage(`${addonType === "telehealth_video" ? "Video" : "SMS"} add-on requested for ${location.name}. Our team will follow up to set up billing.`);
    setRequestingAddon(null);
  }

  const roleColor: Record<string, string> = {
    admin: "bg-red-100 text-red-700",
    director: "bg-purple-100 text-purple-700",
    supervisor: "bg-blue-100 text-blue-700",
    clinician: "bg-green-100 text-green-700",
    rbt: "bg-yellow-100 text-yellow-700",
    bt: "bg-yellow-100 text-yellow-700",
    student_analyst: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Locations & Staff Assignments">
        <Button onClick={handleAddLocationClick}>
          {showForm ? "Cancel" : "+ Add Location"}
        </Button>
      </PageHeader>

      {urlMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
          {urlMessage}
        </div>
      )}

      {requestSent && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
          Location added. Our team will follow up to set up billing for this location.
        </div>
      )}

      {addonMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
          {addonMessage}
        </div>
      )}
      {addonError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {addonError}
        </div>
      )}

      {(() => {
        const gate = canAddLocation();
        if (!gate.allowed) return (
          <UpgradePrompt
            reason={"Your " + planName + " plan allows up to " + limits.locations + " location" + (limits.locations === 1 ? "" : "s") + ". Upgrade to add more."}
            upgradeTo={gate.upgradeTo}
            feature="Additional Locations"
          />
        );
        return locations.length > 0 ? (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            Your first location is included free. Additional locations are $49/mo each - our team will follow up to set up billing after you add one.
          </div>
        ) : null;
      })()}

      {showForm && (
        <Section title={locations.length === 0 ? "New Location (Free)" : "New Location - $49/mo"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Location Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Main Clinic, North Office"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Address</label>
              <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Street address"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">City</label>
              <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">State</label>
                <select value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">Select...</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">ZIP</label>
                <input type="text" value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div />
            <div className="md:col-span-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-1">Geofence Coordinates (optional)</p>
              <p className="text-xs text-gray-400 mb-3">
                Find coordinates at <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">maps.google.com</a> - right-click your location and copy the coordinates.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Latitude</label>
                  <input type="number" step="0.000001" value={form.lat}
                    onChange={e => setForm({ ...form, lat: e.target.value })}
                    placeholder="e.g. 38.3032"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Longitude</label>
                  <input type="number" step="0.000001" value={form.lng}
                    onChange={e => setForm({ ...form, lng: e.target.value })}
                    placeholder="e.g. -77.4605"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Radius (meters)</label>
                  <input type="number" value={form.radius}
                    onChange={e => setForm({ ...form, radius: e.target.value })}
                    placeholder="300"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2 items-center">
            <Button onClick={handleSave} loading={saving}>
              {locations.length >= 1 ? "Add Location ($49/mo)" : "Save Location"}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); }}>Cancel</Button>
          </div>
        </Section>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      <div className="space-y-4">
        {locations.map(loc => {
          const assignedUsers = getUsersForLocation(loc.id);
          const isExpanded = expandedLocation === loc.id;
          const hasCoords = loc.lat && loc.lng;
          const estimate = estimateAddonCost(assignedUsers.length);
          const videoAddon = getAddonForLocation(loc.id, "telehealth_video");
          const smsAddon = getAddonForLocation(loc.id, "sms");

          return (
            <div key={loc.id} className={"border rounded-xl bg-white " + (!loc.is_active ? "opacity-60 border-gray-100" : "border-gray-200")}>
              <div className="p-4">
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-800 text-lg">{loc.name}</p>
                      <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (loc.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                        {loc.is_active ? "Active" : "Inactive"}
                      </span>
                      {loc.payment_status === "pending" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                          Payment Pending - We will follow up to set up billing
                        </span>
                      )}
                      {hasCoords ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          Geofence set ({loc.radius ?? 300}m)
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                          No geofence
                        </span>
                      )}
                    </div>
                    {(loc.address || loc.city) && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {[loc.address, loc.city, loc.state, loc.zip].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {loc.phone && <p className="text-xs text-gray-400 mt-0.5">{loc.phone}</p>}
                    {hasCoords && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">
                        {loc.lat?.toFixed(5)}, {loc.lng?.toFixed(5)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{assignedUsers.length} staff assigned</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => {
                      setEditingCoords(editingCoords === loc.id ? null : loc.id);
                      setCoordForm({
                        lat: loc.lat?.toString() ?? "",
                        lng: loc.lng?.toString() ?? "",
                        radius: loc.radius?.toString() ?? "300",
                      });
                    }}
                      className="px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg text-xs hover:bg-blue-50">
                      {hasCoords ? "Edit Coords" : "Set Coords"}
                    </button>
                    <button onClick={() => setExpandedLocation(isExpanded ? null : loc.id)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                      {isExpanded ? "Hide Staff" : "Manage Staff"}
                    </button>
                    <button onClick={() => toggleLocation(loc.id, loc.is_active)}
                      className={"px-3 py-1.5 border rounded-lg text-xs " + (loc.is_active ? "border-orange-200 text-orange-600 hover:bg-orange-50" : "border-green-200 text-green-600 hover:bg-green-50")}>
                      {loc.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => deleteLocation(loc.id)}
                      className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </div>

                {/* VIDEO & SMS ADD-ONS */}
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Video & SMS Add-ons for {loc.name}</p>
                  {assignedUsers.length === 0 ? (
                    <p className="text-xs text-gray-400">Assign staff to this location to see estimated add-on costs.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* VIDEO */}
                      <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-800">Telehealth Video</p>
                          {videoAddon ? (
                            <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (videoAddon.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                              {videoAddon.status === "active" ? "Active" : "Pending"}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Not enrolled</span>
                          )}
                        </div>
                        {estimate && (
                          <p className="text-xs text-gray-500 mb-2">
                            Est. ${estimate.video.low}-${estimate.video.high}/mo based on {assignedUsers.length} staff (5-10 sessions/wk each, $60 base + usage)
                          </p>
                        )}
                        {!videoAddon && (
                          <button
                            onClick={() => requestAddon(loc, "telehealth_video")}
                            disabled={requestingAddon === `${loc.id}:telehealth_video`}
                            className="text-xs px-3 py-1.5 border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 disabled:opacity-50">
                            {requestingAddon === `${loc.id}:telehealth_video` ? "Requesting..." : "Request Video Add-on"}
                          </button>
                        )}
                      </div>

                      {/* SMS */}
                      <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-800">SMS Notifications</p>
                          {smsAddon ? (
                            <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (smsAddon.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                              {smsAddon.status === "active" ? "Active" : "Pending"}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Not enrolled</span>
                          )}
                        </div>
                        {estimate && (
                          <p className="text-xs text-gray-500 mb-2">
                            Est. ${estimate.sms.low}-${estimate.sms.high}/mo based on {assignedUsers.length} staff (3-4 texts/day each, $35 base + usage)
                          </p>
                        )}
                        {!smsAddon && (
                          <button
                            onClick={() => requestAddon(loc, "sms")}
                            disabled={requestingAddon === `${loc.id}:sms`}
                            className="text-xs px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50">
                            {requestingAddon === `${loc.id}:sms` ? "Requesting..." : "Request SMS Add-on"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {editingCoords === loc.id && (
                  <div className="mt-4 border border-blue-100 rounded-xl p-4 bg-blue-50">
                    <p className="text-sm font-semibold text-blue-700 mb-2">Geofence Coordinates</p>
                    <p className="text-xs text-blue-500 mb-3">
                      Find coordinates at <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="underline">maps.google.com</a> - right-click your clinic location and copy the lat/lng.
                    </p>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Latitude</label>
                        <input type="number" step="0.000001" value={coordForm.lat}
                          onChange={e => setCoordForm({ ...coordForm, lat: e.target.value })}
                          placeholder="e.g. 38.3032"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Longitude</label>
                        <input type="number" step="0.000001" value={coordForm.lng}
                          onChange={e => setCoordForm({ ...coordForm, lng: e.target.value })}
                          placeholder="e.g. -77.4605"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Radius (meters)</label>
                        <input type="number" value={coordForm.radius}
                          onChange={e => setCoordForm({ ...coordForm, radius: e.target.value })}
                          placeholder="300"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => saveCoords(loc.id)} loading={savingCoords}>Save Coordinates</Button>
                      <Button variant="outline" onClick={() => setEditingCoords(null)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Staff Access for {loc.name}</p>
                    <div className="space-y-2">
                      {profiles.map(profile => {
                        const assigned = isAssigned(profile.id, loc.id);
                        const primary = isPrimary(profile.id, loc.id);
                        return (
                          <div key={profile.id} className={"flex items-center justify-between border rounded-lg p-3 transition-all " + (assigned ? "border-blue-100 bg-blue-50" : "border-gray-100 bg-white")}>
                            <div className="flex items-center gap-3">
                              <div className={"w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold " + (assigned ? "bg-blue-200 text-blue-700" : "bg-gray-200 text-gray-500")}>
                                {(profile.full_name ?? "?")[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-800">{profile.full_name?? "Unknown"}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {profile.role && (
                                    <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (roleColor[profile.role] ?? "bg-gray-100 text-gray-600")}>
                                      {profile.role}
                                    </span>
                                  )}
                                  {primary && <span className="text-xs text-blue-600 font-medium">Primary</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {assigned && !primary && (
                                <button onClick={() => setPrimary(profile.id, loc.id)}
                                  className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 border border-gray-200 rounded-lg">
                                  Set Primary
                                </button>
                              )}
                              <button onClick={() => toggleAssignment(profile.id, loc.id)}
                                className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-all " + (assigned ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-gray-300 text-gray-600 hover:border-blue-400")}>
                                {assigned ? "Assigned" : "+ Assign"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!loading && locations.length === 0 && (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
            <p className="text-gray-600 font-medium">No locations yet</p>
            <p className="text-gray-400 text-sm mt-1">Add your first location free. Additional locations are $49/mo each.</p>
          </div>
        )}
      </div>
    </div>
  );
}
