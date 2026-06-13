"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

type Availability = {
  id: string;
  client_id: string | null;
  initials: string;
  city: string | null;
  county: string | null;
  state: string | null;
  available_hours_per_week: number | null;
  available_days: string[] | null;
  summary: string | null;
  bcba_user_id: string | null;
  bcba_name?: string;
  is_active: boolean;
  created_at: string;
};

type Invite = {
  id: string;
  availability_id: string;
  invite_token: string;
  bcba_signed: boolean;
  bcba_signed_at: string | null;
  student_user_id: string | null;
  status: string;
  created_at: string;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ClientAvailabilityPage() {
  const [listings, setListings] = useState<Availability[]>([]);
  const [myListings, setMyListings] = useState<Availability[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [activeTab, setActiveTab] = useState<"board" | "my_listings" | "invites">("board");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState("");

  // Form state
  const [initials, setInitials] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [state, setState] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [summary, setSummary] = useState("");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    setCompanyId(companyUser?.company_id ?? "");
    setUserRole(companyUser?.role ?? "");

    const [{ data: allListings }, { data: myInvites }] = await Promise.all([
      supabase.from("client_availability")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("availability_invites")
        .select("*")
        .eq("bcba_user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    // Get BCBA names
    const listings = allListings ?? [];
    const bcbaIds = [...new Set(listings.map((l: Availability) => l.bcba_user_id).filter(Boolean))];
    let bcbaNames: Record<string, string> = {};
    if (bcbaIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", bcbaIds);
      bcbaNames = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]));
    }

    const enriched = listings.map((l: Availability) => ({
      ...l,
      bcba_name: l.bcba_user_id ? bcbaNames[l.bcba_user_id] : undefined,
    }));

    setListings(enriched.filter((l: Availability) => l.bcba_user_id !== user.id));
    setMyListings(enriched.filter((l: Availability) => l.bcba_user_id === user.id));
    setInvites(myInvites ?? []);
    setLoading(false);
  }

  async function handlePost() {
    if (!initials.trim()) return;
    setSaving(true);

    await supabase.from("client_availability").insert({
      company_id: companyId,
      initials: initials.trim().toUpperCase(),
      city: city.trim() || null,
      county: county.trim() || null,
      state: state.trim() || null,
      available_hours_per_week: hoursPerWeek ? parseFloat(hoursPerWeek) : null,
      available_days: selectedDays.length > 0 ? selectedDays : null,
      summary: summary.trim() || null,
      bcba_user_id: userId,
      posted_by: userId,
    });

    setInitials(""); setCity(""); setCounty(""); setState("");
    setHoursPerWeek(""); setSelectedDays([]); setSummary("");
    setShowForm(false);
    await init();
    setSaving(false);
  }

  async function generateInvite(availabilityId: string) {
    const { data } = await supabase.from("availability_invites").insert({
      availability_id: availabilityId,
      bcba_user_id: userId,
      bcba_signed: false,
      status: "pending",
    }).select().single();

    if (data) {
      setInvites(prev => [data, ...prev]);
      const link = `${window.location.origin}/dashboard/client-availability/join?token=${data.invite_token}`;
      await navigator.clipboard.writeText(link);
      setCopiedToken(data.invite_token);
      setTimeout(() => setCopiedToken(""), 3000);
    }
  }

  async function signInvite(inviteId: string) {
    await supabase.from("availability_invites").update({
      bcba_signed: true,
      bcba_signed_at: new Date().toISOString(),
      status: "signed",
    }).eq("id", inviteId);
    setInvites(prev => prev.map(i => i.id === inviteId ? { ...i, bcba_signed: true, status: "signed" } : i));
  }

  async function toggleListing(id: string, active: boolean) {
    await supabase.from("client_availability").update({ is_active: !active }).eq("id", id);
    await init();
  }

  function toggleDay(day: string) {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  }

  const isBCBA = ["supervisor", "clinical_director", "admin"].includes(userRole);

  if (loading) return <div className="p-8 text-gray-400">Loading availability board...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Client Availability Board">
        <p className="text-sm text-gray-500">Available clients across the ABA community</p>
      </PageHeader>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
        🔒 All client information is anonymized. Only initials and general location are shown to protect client privacy.
        {!isBCBA && " Student analysts can only access listings they have been invited to by a BCBA."}
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "board", label: "Availability Board" },
          ...(isBCBA ? [
            { key: "my_listings", label: `My Listings (${myListings.length})` },
            { key: "invites", label: `Invites (${invites.length})` },
          ] : []),
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* BOARD */}
      {activeTab === "board" && (
        <div className="space-y-4">
          {isBCBA && (
            <div className="flex justify-end">
              <Button onClick={() => setShowForm(s => !s)}>
                {showForm ? "✕ Cancel" : "+ Post Availability"}
              </Button>
            </div>
          )}

          {showForm && isBCBA && (
            <Section title="Post Client Availability">
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
                  ⚠️ Only post anonymized information. Do not include the client's full name, address, or any identifying PHI.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Client Initials *</label>
                    <input type="text" value={initials} onChange={e => setInitials(e.target.value.toUpperCase())}
                      placeholder="e.g. J.D." maxLength={5}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Hours/Week</label>
                    <input type="number" value={hoursPerWeek} onChange={e => setHoursPerWeek(e.target.value)}
                      placeholder="e.g. 20"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">City</label>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)}
                      placeholder="e.g. Fredericksburg"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">County</label>
                    <input type="text" value={county} onChange={e => setCounty(e.target.value)}
                      placeholder="e.g. Stafford"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">State</label>
                    <input type="text" value={state} onChange={e => setState(e.target.value)}
                      placeholder="e.g. VA" maxLength={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Available Days</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                      <button key={day} type="button" onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedDays.includes(day) ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Brief Summary</label>
                  <textarea value={summary} onChange={e => setSummary(e.target.value)}
                    placeholder="Brief description of what the client will work on (no identifying information)..."
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <Button onClick={handlePost} loading={saving} disabled={!initials.trim()}>
                  Post to Board
                </Button>
              </div>
            </Section>
          )}

          {listings.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm">No available clients posted yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map(listing => (
                <div key={listing.id} className="border border-gray-100 rounded-2xl p-5 bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <span className="text-blue-700 font-bold text-lg">{listing.initials}</span>
                    </div>
                    {listing.available_hours_per_week && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                        {listing.available_hours_per_week}h/week
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 mb-3">
                    {(listing.city || listing.county || listing.state) && (
                      <p className="text-xs text-gray-500">
                        📍 {[listing.city, listing.county, listing.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {listing.available_days && listing.available_days.length > 0 && (
                      <p className="text-xs text-gray-500">
                        📅 {listing.available_days.map(d => d.slice(0, 3)).join(", ")}
                      </p>
                    )}
                    {listing.bcba_name && (
                      <p className="text-xs text-gray-500">👤 BCBA: {listing.bcba_name}</p>
                    )}
                  </div>

                  {listing.summary && (
                    <p className="text-xs text-gray-600 mb-3 line-clamp-3">{listing.summary}</p>
                  )}

                  {isBCBA && (
                    <button
                      onClick={() => generateInvite(listing.id)}
                      className="w-full text-xs py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors font-medium">
                      {copiedToken ? "✓ Link Copied!" : "🔗 Generate Invite Link"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MY LISTINGS */}
      {activeTab === "my_listings" && isBCBA && (
        <div className="space-y-3">
          {myListings.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm">You haven&apos;t posted any client availability yet.</p>
              <button onClick={() => { setActiveTab("board"); setShowForm(true); }}
                className="mt-3 text-sm text-blue-600 hover:underline">Post your first listing</button>
            </div>
          ) : (
            myListings.map(listing => (
              <div key={listing.id} className={`border rounded-2xl p-5 bg-white ${listing.is_active ? "border-gray-100" : "border-gray-200 opacity-60"}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-blue-700">{listing.initials}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${listing.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {listing.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {(listing.city || listing.state) && (
                      <p className="text-xs text-gray-400">📍 {[listing.city, listing.county, listing.state].filter(Boolean).join(", ")}</p>
                    )}
                    {listing.available_hours_per_week && (
                      <p className="text-xs text-gray-400">⏱️ {listing.available_hours_per_week}h/week</p>
                    )}
                    {listing.available_days && listing.available_days.length > 0 && (
                      <p className="text-xs text-gray-400">📅 {listing.available_days.join(", ")}</p>
                    )}
                    {listing.summary && <p className="text-xs text-gray-500 mt-1">{listing.summary}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => toggleListing(listing.id, listing.is_active)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${listing.is_active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>
                      {listing.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                    <button onClick={() => generateInvite(listing.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                      🔗 Invite
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* INVITES */}
      {activeTab === "invites" && isBCBA && (
        <div className="space-y-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
            ⚠️ By signing an invite, you are approving a student analyst to collaborate on this client. Your signature is required before they can access the listing.
          </div>
          {invites.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🔗</p>
              <p className="text-sm">No invites generated yet. Generate invite links from the board to share with student analysts.</p>
            </div>
          ) : (
            invites.map(invite => (
              <div key={invite.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Invite Token</p>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">{invite.invite_token.slice(0, 16)}...</p>
                    <p className="text-xs text-gray-400 mt-1">Created: {new Date(invite.created_at).toLocaleDateString()}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        invite.status === "signed" ? "bg-green-100 text-green-700" :
                        invite.status === "accepted" ? "bg-blue-100 text-blue-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>{invite.status}</span>
                      {invite.bcba_signed && <span className="text-xs text-green-600">✓ BCBA Signed</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!invite.bcba_signed && (
                      <Button onClick={() => signInvite(invite.id)}>
                        ✍️ Sign Invite
                      </Button>
                    )}
                    <button
                      onClick={async () => {
                        const link = `${window.location.origin}/dashboard/client-availability/join?token=${invite.invite_token}`;
                        await navigator.clipboard.writeText(link);
                        setCopiedToken(invite.invite_token);
                        setTimeout(() => setCopiedToken(""), 2000);
                      }}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                      {copiedToken === invite.invite_token ? "✓ Copied!" : "📋 Copy Link"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}