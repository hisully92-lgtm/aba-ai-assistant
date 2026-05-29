"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

const ABA_CREDENTIALS = [
  "BT", "RBT", "BCaBA", "BCBA", "BCBA-D",
  "CRP", "BACB Certificant", "QBA", "QABA",
  "Licensed Psychologist", "LCSW", "LPC",
  "SLP", "OT", "PT", "Student Analyst",
  "ABAI Member", "APBA Member",
];

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  photo_url: string | null;
  bcba_license_number: string | null;
  credential_expiry: string | null;
  rbt_supervision_hours: number | null;
  credentials: string[] | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [credentialExpiry, setCredentialExpiry] = useState("");
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([]);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setProfile(data);
      setFullName(data.full_name ?? "");
      setPhone(data.phone ?? "");
      setLicenseNumber(data.bcba_license_number ?? "");
      setCredentialExpiry(data.credential_expiry ?? "");
      setSelectedCredentials(data.credentials ?? []);
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { error: saveError } = await supabase.from("profiles").update({
      full_name: fullName,
      phone,
      bcba_license_number: licenseNumber || null,
      credential_expiry: credentialExpiry || null,
      credentials: selectedCredentials,
    } as any).eq("id", user.id);

    if (saveError) {
      setError(saveError.message);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });

    if (uploadError) {
      setError("Photo upload failed. Make sure the avatars storage bucket exists in Supabase.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const photoUrl = urlData.publicUrl;

    await supabase.from("profiles").update({ photo_url: photoUrl } as any).eq("id", user.id);
    setProfile(prev => prev ? { ...prev, photo_url: photoUrl } : prev);
    setUploading(false);
  }

  function toggleCredential(cred: string) {
    setSelectedCredentials(prev =>
      prev.includes(cred) ? prev.filter(c => c !== cred) : [...prev, cred]
    );
  }

  function roleBadge(role: string | null) {
    if (!role) return "bg-gray-100 text-gray-500";
    if (role === "admin") return "bg-purple-100 text-purple-700";
    if (role === "supervisor" || role === "clinical_director") return "bg-blue-100 text-blue-700";
    return "bg-green-100 text-green-700";
  }

  if (loading) return <div className="p-8 text-gray-400">Loading profile...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" />

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Profile saved successfully.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Section title="Profile Photo">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl text-gray-300">👤</span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{fullName || "Your Name"}</p>
            {profile?.role && (
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${roleBadge(profile.role)}`}>
                {profile.role.replace("_", " ")}
              </span>
            )}
            <div className="mt-3">
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              <Button variant="outline" onClick={() => fileRef.current?.click()} loading={uploading}>
                {uploading ? "Uploading..." : "Change Photo"}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Personal Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
      </Section>

      <Section title="Professional Credentials">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">ABA Credentials (select all that apply)</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {ABA_CREDENTIALS.map(cred => (
                <label key={cred} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCredentials.includes(cred)}
                    onChange={() => toggleCredential(cred)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  {cred}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">License / Credential Number</label>
              <input type="text" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)}
                placeholder="e.g. 1-20-12345"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Credential Expiry Date</label>
              <input type="date" value={credentialExpiry} onChange={e => setCredentialExpiry(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">RBT Supervision Hours (logged)</label>
            <p className="text-2xl font-bold text-blue-600">{profile?.rbt_supervision_hours ?? 0}h</p>
            <p className="text-xs text-gray-400">Automatically tracked from supervision logs</p>
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={handleSave} loading={saving}>Save Profile</Button>
        </div>
      </Section>
    </div>
  );
}