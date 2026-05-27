"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { useRole } from "@/lib/hooks/useRole";

type TimeOffRequest = {
  id: string;
  user_id: string;
  request_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
};
type Profile = { id: string; full_name: string | null; role: string | null };

const REQUEST_TYPES = ["Vacation", "Sick Leave", "Personal", "Bereavement", "FMLA", "Jury Duty", "Unpaid Leave", "Other"];

const emptyForm = {
  request_type: "Vacation",
  start_date: "",
  end_date: "",
  reason: "",
};

export default function TimeOffPage() {
  const { isSupervisor, isAdmin, isDeveloper, userId } = useRole();
  const canReview = isSupervisor || isAdmin || isDeveloper;

  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"mine" | "team">("mine");

  useEffect(() => { init(); }, [userId]);

  async function init() {
    if (!userId) return;

    const [{ data: profileData }, { data: requestData }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, role"),
      canReview
        ? supabase.from("time_off_requests").select("*").order("created_at", { ascending: false })
        : supabase.from("time_off_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);

    setProfiles(profileData ?? []);
    setRequests(requestData ?? []);
    setLoading(false);
  }

  function calculateDays(start: string, end: string): number {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  }

  async function handleSave() {
    if (!form.start_date || !form.end_date || !userId) return;
    setSaving(true);

    const totalDays = calculateDays(form.start_date, form.end_date);

    const { data } = await supabase.from("time_off_requests").insert([{
      ...form,
      user_id: userId,
      total_days: totalDays,
      reason: form.reason || null,
      status: "pending",
      created_by: userId,
    }]).select().single();

    if (data) setRequests((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function handleReview(id: string, status: string) {
    if (!userId) return;

    const { data } = await supabase.from("time_off_requests").update({
      status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes || null,
    }).eq("id", id).select().single();

    if (data) setRequests((prev) => prev.map((r) => r.id === id ? data : r));
    setReviewingId(null);
    setReviewerNotes("");
  }

  async function cancelRequest(id: string) {
    await supabase.from("time_off_requests").update({ status: "cancelled" }).eq("id", id);
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "cancelled" } : r));
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? "Unknown"]));

  const myRequests = requests.filter((r) => r.user_id === userId);
  const teamRequests = requests.filter((r) => r.user_id !== userId);

  function filterRequests(list: TimeOffRequest[]) {
    if (filterStatus === "all") return list;
    return list.filter((r) => r.status === filterStatus);
  }

  const displayRequests = filterRequests(activeTab === "mine" ? myRequests : teamRequests);

  function statusColor(status: string) {
    if (status === "approved") return "bg-green-100 text-green-700";
    if (status === "denied") return "bg-red-100 text-red-700";
    if (status === "pending") return "bg-yellow-100 text-yellow-700";
    if (status === "cancelled") return "bg-gray-100 text-gray-500";
    return "bg-gray-100 text-gray-600";
  }

  function typeColor(type: string) {
    if (type === "Vacation") return "bg-blue-100 text-blue-700";
    if (type === "Sick Leave") return "bg-red-100 text-red-700";
    if (type === "Personal") return "bg-purple-100 text-purple-700";
    if (type === "FMLA") return "bg-orange-100 text-orange-700";
    return "bg-gray-100 text-gray-600";
  }

  const myApproved = myRequests.filter((r) => r.status === "approved").reduce((a, b) => a + b.total_days, 0);
  const myPending = myRequests.filter((r) => r.status === "pending").length;
  const teamPending = teamRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Time Off Requests">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Request Time Off"}
        </Button>
      </PageHeader>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">{myApproved}</p>
          <p className="text-xs text-gray-500 mt-1">Days Approved</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-yellow-600">{myPending}</p>
          <p className="text-xs text-gray-500 mt-1">My Pending</p>
        </div>
        {canReview && (
          <>
            <div className="border rounded-xl p-4 text-center bg-white">
              <p className="text-2xl font-bold text-orange-500">{teamPending}</p>
              <p className="text-xs text-gray-500 mt-1">Team Pending Review</p>
            </div>
            <div className="border rounded-xl p-4 text-center bg-white">
              <p className="text-2xl font-bold text-blue-600">{teamRequests.length}</p>
              <p className="text-xs text-gray-500 mt-1">Total Team Requests</p>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <Section title="Request Time Off">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Request Type *</label>
              <select value={form.request_type} onChange={(e) => setForm({ ...form, request_type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {REQUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date *</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">End Date *</label>
                <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Reason (optional)</label>
              <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Optional reason for your request..." rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          {form.start_date && form.end_date && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              Total days requested: <span className="font-bold">{calculateDays(form.start_date, form.end_date)}</span>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving} disabled={!form.start_date || !form.end_date}>
              Submit Request
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* TABS */}
      {canReview && (
        <div className="flex gap-2 border-b border-gray-200">
          {[
            { key: "mine", label: `My Requests (${myRequests.length})` },
            { key: "team", label: `Team Requests (${teamRequests.length})` },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* FILTER */}
      <div className="flex gap-2">
        {["all", "pending", "approved", "denied", "cancelled"].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
            {s}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && displayRequests.length === 0 && (
        <Section title="No Requests">
          <p className="text-gray-400 text-sm">No time off requests found.</p>
        </Section>
      )}

      <div className="space-y-3">
        {displayRequests.map((request) => {
          const isReviewing = reviewingId === request.id;
          const isMyRequest = request.user_id === userId;

          return (
            <div key={request.id} className={`border rounded-xl bg-white ${request.status === "approved" ? "border-green-200" : request.status === "denied" ? "border-red-200" : request.status === "pending" ? "border-yellow-200" : "border-gray-100"}`}>
              <div className="p-4">
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isMyRequest && (
                        <p className="font-semibold text-gray-800">{profileMap.get(request.user_id)}</p>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor(request.request_type)}`}>
                        {request.request_type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">
                      {request.start_date} → {request.end_date}
                      <span className="text-gray-400 ml-2">({request.total_days} day{request.total_days !== 1 ? "s" : ""})</span>
                    </p>
                    {request.reason && <p className="text-xs text-gray-500 mt-0.5">{request.reason}</p>}
                    {request.reviewer_notes && (
                      <p className="text-xs text-gray-500 mt-1 italic">Reviewer note: {request.reviewer_notes}</p>
                    )}
                    {request.reviewed_by && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Reviewed by {profileMap.get(request.reviewed_by)} · {request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {isMyRequest && request.status === "pending" && (
                      <Button variant="danger" onClick={() => cancelRequest(request.id)}>Cancel</Button>
                    )}
                    {canReview && !isMyRequest && request.status === "pending" && (
                      <Button variant="outline" onClick={() => setReviewingId(isReviewing ? null : request.id)}>
                        {isReviewing ? "Cancel Review" : "Review"}
                      </Button>
                    )}
                  </div>
                </div>

                {isReviewing && (
                  <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Reviewer Notes (optional)</label>
                      <textarea value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)}
                        placeholder="Add notes for the employee..." rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleReview(request.id, "approved")}
                        className="bg-green-600 hover:bg-green-700">✓ Approve</Button>
                      <Button onClick={() => handleReview(request.id, "denied")} variant="danger">✗ Deny</Button>
                      <Button variant="outline" onClick={() => setReviewingId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}