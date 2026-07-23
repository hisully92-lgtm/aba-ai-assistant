"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

export default function BrandingSettingsPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { setLoading(false); return; }

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!companyUser?.company_id) { setLoading(false); return; }
    setCompanyId(companyUser.company_id);
    setIsAdmin(companyUser.role === "admin");

    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyUser.company_id)
      .single();

    if (company) {
      setOrgName(company.name);
      setOriginalName(company.name);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!companyId || !orgName.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setError("Not authenticated."); setSaving(false); return; }

    const res = await fetch("/api/admin/update-company-name", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ companyId, name: orgName.trim() }),
    });

    const result = await res.json();
    if (!res.ok) {
      setError(result.error ?? "Failed to update organization name.");
      setSaving(false);
      return;
    }

    setOriginalName(orgName.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  }

  const hasChanges = orgName.trim() !== originalName && orgName.trim().length > 0;

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Organization & Branding">
        <p className="text-gray-500 text-sm">Manage your organization's name and identity.</p>
      </PageHeader>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">✓ Organization name updated.</div>}

      <Section title="Organization Name">
        {!isAdmin ? (
          <p className="text-sm text-gray-500">Only an admin of your organization can rename it. Contact your clinic admin if this needs to change.</p>
        ) : (
          <div className="space-y-3 max-w-md">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Organization Name</label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="Your clinic or organization name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <p className="text-xs text-gray-400 mt-1">This name appears throughout your dashboard, on invoices, and in messages to your staff and clients.</p>
            </div>
            <Button onClick={handleSave} loading={saving} disabled={!hasChanges}>
              Save Organization Name
            </Button>
          </div>
        )}
      </Section>

      <Section title="Logo & Colors">
        <p className="text-sm text-gray-400">Custom logo and color branding coming soon.</p>
      </Section>
    </div>
  );
}
