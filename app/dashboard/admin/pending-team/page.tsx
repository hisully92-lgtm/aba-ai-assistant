"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

type PendingMember = {
  userId: string;
  name: string;
  email: string;
  requestedRole: string;
  attemptedAt: string;
};

const ROLES = ["rbt", "clinician", "supervisor", "bcba", "admin"];

export default function PendingTeamMembersPage() {
  const [pending, setPending] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleOverrides, setRoleOverrides] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState<string | null>(null);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/pending-team-members", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load");
      }
      const { pending: rows } = await res.json();
      setPending(rows ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load pending team members");
    } finally {
      setLoading(false);
    }
  }

  async function linkUser(userId: string) {
    setLinking(userId);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const role = roleOverrides[userId] ?? pending.find((p) => p.userId === userId)?.requestedRole ?? "clinician";

      const res = await fetch("/api/admin/link-pending-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId, role }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add to team");
      }

      setLinkedIds((prev) => new Set(prev).add(userId));
    } catch (err: any) {
      setError(err.message || "Failed to add to team");
    } finally {
      setLinking(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pending Team Members">
        <p className="text-gray-500 text-sm">
          People who entered your clinic code but never finished signing up — link them here instead of asking them to redo it.
        </p>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}

      <Section title={`Pending (${pending.length})`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}

        {!loading && pending.length === 0 && (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-gray-500 text-sm">No pending sign-ups — everyone who's tried to join has been linked.</p>
          </div>
        )}

        <div className="space-y-3">
          {pending.map((p) => {
            const isLinked = linkedIds.has(p.userId);
            return (
              <div key={p.userId} className={`border rounded-xl p-4 ${isLinked ? "border-green-200 bg-green-50" : "border-gray-100 bg-white"}`}>
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <p className="font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Attempted {new Date(p.attemptedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLinked ? (
                      <span className="text-sm text-green-700 font-medium">✓ Added to team</span>
                    ) : (
                      <>
                        <select
                          value={roleOverrides[p.userId] ?? p.requestedRole}
                          onChange={(e) => setRoleOverrides((prev) => ({ ...prev, [p.userId]: e.target.value }))}
                          className="border rounded-lg px-2 py-1.5 text-sm"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => linkUser(p.userId)}
                          disabled={linking === p.userId}
                          className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
                        >
                          {linking === p.userId ? "Adding..." : "Add to Team"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
