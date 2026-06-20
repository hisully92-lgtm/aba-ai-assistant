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

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const emptyForm = {
  name: "", address: "", city: "", state: "", zip: "",
  phone: "", lat: "", lng: "", radius: "300",
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [billingType, setBillingType] = useState<"addon" | "separate" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);
  const [editingCoords, setEditingCoords] = useState<string | null>(null);
  const [coordForm, setCoordForm] = useState({ lat: "", lng: "", radius: "300" });
  const [savingCoords, setSavingCoords] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { canAddLocation, limits, planName } = usePlanGate();
  const [processingPayment, setProcessingPayment] = useState(false);

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

    const [{ data: locData }, { data: profileData }, { data: assignData }] = await Promise.all([
      supabase.from("locations").select("*").eq("company_id", companyUser.company_id).order("name"),
      supabase.from("profiles").select("id, full_name, role, email"),
      supabase.from("user_location_assignments").select("user_id, location_id, is_primary"),
    ]);

    setLocations(locData ?? []);
    setProfiles(profileData ?? []);
    setAssignments(assignData ?? []);
    setLoading(false);
  }

  function handleAddLocationClick() {
    // Check plan gate first
    const gate = canAddLocation();
    if (!gate.allowed) return;

    if (locations.length === 0) {
      // First location is free
      setShowForm(true);
    } else {
      // Additional locations require payment
      setShowPaymentModal(true);
      setBillingType(null);
    }
  }

  async function handlePaymentProceed() {
    if (!billingType || !form.name || !companyId) {
      // Show form first to get location name
      setShowPaymentModal(false);
      setShowForm(true);
      return;
    }
    await processPayment();
  }

  async function processPayment() {
    if (!companyId || !form.name) return;
    setProcessingPayment(true);

    const { data: auth } = await supabase.auth.getUser();
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    const res = await fetch("/api/square/location-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        companyId,
        locationName: form.name,
        billingType,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      alert("Payment setup failed: " + result.error);
      setProcessingPayment(false);
      return;
    }

    // Redirect to Square checkout
    window.location.href = result.url;
  }

  async function handleSave() {
    if (!form.name || !companyId) return;

    // If this is an additional location, require payment first
    if (locations.length >= 1 && !billingType) {
      setShowPaymentModal(true);
      return;
    }

    setSaving(true);
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
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      alert("Failed to save location: " + result.error);
    } else if (result.data) {
      setLocations(prev => [...prev, result.data]);
      setForm(emptyForm);
      setShowForm(false);
      setBillingType(null);
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

      {/* PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Add a New Location</h3>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">Payment Required</p>
              <p>Each additional location costs <strong>$49/month</strong>. Square will process your payment and your new location will become active once payment is confirmed. A confirmation email will be sent to your admin email.</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">Choose billing method:</p>

              <button
                onClick={() => setBillingType("addon")}
                className={`w-full text-left border rounded-xl p-4 transition-all ${billingType === "addon" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
                <p className="font-semibold text-gray-800 text-sm">Add to existing subscription</p>
                <p className="text-xs text-gray-500 mt-1">$49/mo added to your current billing cycle. Managed together with your plan.</p>
              </button>

              <button
                onClick={() => setBillingType("separate")}
                className={`w-full text-left border rounded-xl p-4 transition-all ${billingType === "separate" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
                <p className="font-semibold text-gray-800 text-sm">Separate Square payment</p>
                <p className="text-xs text-gray-500 mt-1">$49/mo billed as a separate subscription. Good for keeping location billing independent.</p>
              </button>
            </div>

            {billingType && (
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Location name (required before checkout):</p>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. North Office, Second Clinic"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            )}

            <p className="text-xs text-gray-400">
              You will be redirected to Square to complete payment. Your location will activate automatically once Square confirms the transaction.
            </p>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowPaymentModal(false); setBillingType(null); }}
                className="px-4 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!billingType || !form.name) return;
                  setShowPaymentModal(false);
                  setShowForm(true);
                }}
                disabled={!billingType || !form.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                Continue to Location Details
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader title="Locations & Staff Assignments">
        <Button onClick={handleAddLocationClick}>
          {showForm ? "Cancel" : "+ Add Location"}
        </Button>
      </PageHeader>

      {(() => {
        const gate = canAddLocation();
        if (!gate.allowed) return (
          <UpgradePrompt
            reason={`Your ${planName} plan allows up to ${limits.locations} location${limits.locations === 1 ? "" : "s"}. Upgrade to add more.`}
            upgradeTo={gate.upgradeTo}
            feature="Additional Locations"
          />
        );
        return locations.length > 0 ? (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            Your first location is included free. Additional locations are $49/mo each, billed through Square.
          </div>
        ) : null;
      })()}

      {showForm && (
        <Section title={locations.length === 0 ? "New Location (Free)" : `New Location — $49/mo (${billingType === "addon" ? "Added to subscription" : "Separate payment"})`}>
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
                Find coordinates at <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">maps.google.com</a> — right-click your location and copy the coordinates.
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
            {locations.length >= 1 && billingType ? (
              <button
                onClick={processPayment}
                disabled={processingPayment || !form.name.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {processingPayment ? "Redirecting to Square..." : "Proceed to Payment ($49/mo)"}
              </button>
            ) : (
              <Button onClick={handleSave} loading={saving}>Save Location</Button>
            )}
            <Button variant="outline" onClick={() => { setShowForm(false); setBillingType(null); }}>Cancel</Button>
          </div>
        </Section>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      <div className="space-y-4">
        {locations.map(loc => {
          const assignedUsers = getUsersForLocation(loc.id);
          const isExpanded = expandedLocation === loc.id;
          const hasCoords = loc.lat && loc.lng;

          return (
            <div key={loc.id} className={`border rounded-xl bg-white ${!loc.is_active ? "opacity-60 border-gray-100" : "border-gray-200"}`}>
              <div className="p-4">
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-800 text-lg">{loc.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${loc.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {loc.is_active ? "Active" : "Inactive"}
                      </span>
                      {loc.payment_status === "pending" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                          Payment Pending
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
                      className={`px-3 py-1.5 border rounded-lg text-xs ${loc.is_active ? "border-orange-200 text-orange-600 hover:bg-orange-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>
                      {loc.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => deleteLocation(loc.id)}
                      className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </div>

                {editingCoords === loc.id && (
                  <div className="mt-4 border border-blue-100 rounded-xl p-4 bg-blue-50">
                    <p className="text-sm font-semibold text-blue-700 mb-2">Geofence Coordinates</p>
                    <p className="text-xs text-blue-500 mb-3">
                      Find coordinates at <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="underline">maps.google.com</a> — right-click your clinic location and copy the lat/lng.
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
                          <div key={profile.id} className={`flex items-center justify-between border rounded-lg p-3 transition-all ${assigned ? "border-blue-100 bg-blue-50" : "border-gray-100 bg-white"}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${assigned ? "bg-blue-200 text-blue-700" : "bg-gray-200 text-gray-500"}`}>
                                {(profile.full_name ?? "?")[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-800">{profile.full_name ?? "Unknown"}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {profile.role && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[profile.role] ?? "bg-gray-100 text-gray-600"}`}>
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
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${assigned ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-gray-300 text-gray-600 hover:border-blue-400"}`}>
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

