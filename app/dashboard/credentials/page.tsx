"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Credential = {
  id: string;
  credential_type: string;
  credential_number: string | null;
  issuing_body: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type CredentialDoc = {
  id: string;
  document_name: string;
  document_type: string | null;
  credential_number: string | null;
  issuing_body: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  file_url: string | null;
  file_name: string | null;
  status: string;
  created_at: string;
};

const CREDENTIAL_TYPES = [
  "BCBA — Board Certified Behavior Analyst",
  "BCaBA — Board Certified Assistant Behavior Analyst",
  "RBT — Registered Behavior Technician",
  "BCBA-D — Doctoral BCBA",
  "LBA — Licensed Behavior Analyst",
  "LABA — Licensed Assistant Behavior Analyst",
  "NPI Number",
  "State License",
  "CPR Certification",
  "First Aid Certification",
  "Mandated Reporter Training",
  "HIPAA Training",
  "CPI / Crisis Prevention",
  "Graduate Degree",
  "Undergraduate Degree",
  "Liability Insurance",
  "Background Check",
  "Other",
];

const DOC_TYPES = [
  "License", "Certificate", "Degree", "Training Record",
  "Insurance", "Background Check", "Transcript", "Other",
];

const emptyCredForm = {
  credential_type: "",
  credential_number: "",
  issuing_body: "",
  issue_date: "",
  expiry_date: "",
  notes: "",
};

const emptyDocForm = {
  document_name: "",
  document_type: "Certificate",
  credential_number: "",
  issuing_body: "",
  issue_date: "",
  expiry_date: "",
  notes: "",
};

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [documents, setDocuments] = useState<CredentialDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCredForm, setShowCredForm] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [savingCred, setSavingCred] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [credForm, setCredForm] = useState(emptyCredForm);
  const [docForm, setDocForm] = useState(emptyDocForm);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"credentials" | "documents">("credentials");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: credData }, { data: docData }] = await Promise.all([
      supabase.from("staff_credentials").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("credential_documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    setCredentials(credData ?? []);
    setDocuments(docData ?? []);
    setLoading(false);
  }

  async function handleSaveCred() {
    if (!credForm.credential_type) return;
    setSavingCred(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("staff_credentials").insert([{
      user_id: user.id,
      credential_type: credForm.credential_type,
      credential_number: credForm.credential_number || null,
      issuing_body: credForm.issuing_body || null,
      issue_date: credForm.issue_date || null,
      expiry_date: credForm.expiry_date || null,
      notes: credForm.notes || null,
      status: "active",
      created_by: user.id,
    }]).select().single();

    if (data) setCredentials((prev) => [data, ...prev]);
    setCredForm(emptyCredForm);
    setShowCredForm(false);
    setSavingCred(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `credentials/${user.id}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("documents")
      .upload(fileName, file, { upsert: true });

    if (!error && data) {
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fileName);
      setUploadedFile({ name: file.name, url: urlData.publicUrl });
    }

    setUploading(false);
  }

  async function handleSaveDoc() {
    if (!docForm.document_name) return;
    setSavingDoc(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("credential_documents").insert([{
      user_id: user.id,
      document_name: docForm.document_name,
      document_type: docForm.document_type || null,
      credential_number: docForm.credential_number || null,
      issuing_body: docForm.issuing_body || null,
      issue_date: docForm.issue_date || null,
      expiry_date: docForm.expiry_date || null,
      notes: docForm.notes || null,
      file_url: uploadedFile?.url || null,
      file_name: uploadedFile?.name || null,
      status: "active",
      created_by: user.id,
    }]).select().single();

    if (data) setDocuments((prev) => [data, ...prev]);
    setDocForm(emptyDocForm);
    setUploadedFile(null);
    setShowDocForm(false);
    setSavingDoc(false);
  }

  async function deleteCred(id: string) {
    await supabase.from("staff_credentials").delete().eq("id", id);
    setCredentials((prev) => prev.filter((c) => c.id !== id));
  }

  async function deleteDoc(id: string) {
    await supabase.from("credential_documents").delete().eq("id", id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  function daysUntilExpiry(date: string | null): number | null {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function expiryColor(days: number | null) {
    if (days === null) return "";
    if (days < 0) return "text-red-600";
    if (days <= 30) return "text-orange-500";
    if (days <= 90) return "text-yellow-600";
    return "text-green-600";
  }

  const expiringSoon = [...credentials, ...documents].filter((c: any) => {
    const days = daysUntilExpiry(c.expiry_date);
    return days !== null && days <= 90 && days > 0;
  });

  const expired = [...credentials, ...documents].filter((c: any) => {
    const days = daysUntilExpiry(c.expiry_date);
    return days !== null && days < 0;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="My Credentials">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShowCredForm(!showCredForm); setShowDocForm(false); }}>
            + Add Credential
          </Button>
          <Button onClick={() => { setShowDocForm(!showDocForm); setShowCredForm(false); }}>
            + Upload Document
          </Button>
        </div>
      </PageHeader>

      {/* ALERTS */}
      {expired.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700">🚨 {expired.length} expired credential{expired.length > 1 ? "s" : ""}</p>
          {expired.map((c: any) => (
            <p key={c.id} className="text-xs text-red-600">{c.credential_type ?? c.document_name} — expired {c.expiry_date}</p>
          ))}
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-bold text-orange-700">⚠️ {expiringSoon.length} expiring within 90 days</p>
          {expiringSoon.map((c: any) => (
            <p key={c.id} className="text-xs text-orange-600">
              {c.credential_type ?? c.document_name} — expires {c.expiry_date} ({daysUntilExpiry(c.expiry_date)} days)
            </p>
          ))}
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-blue-600">{credentials.length}</p>
          <p className="text-xs text-gray-500 mt-1">Credentials</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">{documents.length}</p>
          <p className="text-xs text-gray-500 mt-1">Documents</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-red-500">{expired.length}</p>
          <p className="text-xs text-gray-500 mt-1">Expired</p>
        </div>
      </div>

      {/* ADD CREDENTIAL FORM */}
      {showCredForm && (
        <Section title="Add Credential">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Credential Type *</label>
              <select value={credForm.credential_type} onChange={(e) => setCredForm({ ...credForm, credential_type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select credential...</option>
                {CREDENTIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Credential / License Number</label>
              <input type="text" value={credForm.credential_number}
                onChange={(e) => setCredForm({ ...credForm, credential_number: e.target.value })}
                placeholder="e.g. 1-23-456789"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Issuing Body / Organization</label>
              <input type="text" value={credForm.issuing_body}
                onChange={(e) => setCredForm({ ...credForm, issuing_body: e.target.value })}
                placeholder="e.g. BACB, State Board"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Issue Date</label>
              <input type="date" value={credForm.issue_date}
                onChange={(e) => setCredForm({ ...credForm, issue_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Expiry Date</label>
              <input type="date" value={credForm.expiry_date}
                onChange={(e) => setCredForm({ ...credForm, expiry_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes / Additional Info</label>
              <textarea value={credForm.notes}
                onChange={(e) => setCredForm({ ...credForm, notes: e.target.value })}
                placeholder="Enter any additional credential details, renewal requirements, URLs, or notes..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSaveCred} loading={savingCred}>Save Credential</Button>
            <Button variant="outline" onClick={() => setShowCredForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* UPLOAD DOCUMENT FORM */}
      {showDocForm && (
        <Section title="Upload Credential Document">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Document Name *</label>
              <input type="text" value={docForm.document_name}
                onChange={(e) => setDocForm({ ...docForm, document_name: e.target.value })}
                placeholder="e.g. BCBA Certificate, NPI Confirmation"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Document Type</label>
              <select value={docForm.document_type}
                onChange={(e) => setDocForm({ ...docForm, document_type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Credential / License Number</label>
              <input type="text" value={docForm.credential_number}
                onChange={(e) => setDocForm({ ...docForm, credential_number: e.target.value })}
                placeholder="Optional credential number"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Issuing Body</label>
              <input type="text" value={docForm.issuing_body}
                onChange={(e) => setDocForm({ ...docForm, issuing_body: e.target.value })}
                placeholder="e.g. BACB, State Board"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Issue Date</label>
              <input type="date" value={docForm.issue_date}
                onChange={(e) => setDocForm({ ...docForm, issue_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Expiry Date</label>
              <input type="date" value={docForm.expiry_date}
                onChange={(e) => setDocForm({ ...docForm, expiry_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Upload Document</label>
              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${uploadedFile ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-blue-400"}`}>
                {uploadedFile ? (
                  <div>
                    <p className="text-green-600 font-medium text-sm">✓ {uploadedFile.name}</p>
                    <button onClick={() => setUploadedFile(null)} className="text-xs text-gray-400 hover:text-red-400 mt-1">Remove</button>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl mb-2">📄</p>
                    <p className="text-sm text-gray-600 mb-2">Upload PDF, JPG, or PNG</p>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                      {uploading ? "Uploading..." : "Choose File"}
                    </Button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} className="hidden" />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={docForm.notes}
                onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })}
                placeholder="Additional notes about this document..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSaveDoc} loading={savingDoc}>Save Document</Button>
            <Button variant="outline" onClick={() => setShowDocForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "credentials", label: `Credentials (${credentials.length})` },
          { key: "documents", label: `Documents (${documents.length})` },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {/* CREDENTIALS TAB */}
      {activeTab === "credentials" && (
        <div className="space-y-3">
          {credentials.length === 0 && !loading && (
            <Section title="No Credentials Yet">
              <p className="text-gray-400 text-sm">Click "+ Add Credential" to add your credentials.</p>
            </Section>
          )}
          {credentials.map((cred) => {
            const days = daysUntilExpiry(cred.expiry_date);
            return (
              <div key={cred.id} className={`border rounded-xl p-4 bg-white ${days !== null && days < 0 ? "border-red-200" : days !== null && days <= 30 ? "border-orange-200" : "border-gray-100"}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">{cred.credential_type}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      {cred.credential_number && <span>#{cred.credential_number}</span>}
                      {cred.issuing_body && <span>{cred.issuing_body}</span>}
                      {cred.issue_date && <span>Issued: {cred.issue_date}</span>}
                      {cred.expiry_date && (
                        <span className={expiryColor(days)}>
                          Expires: {cred.expiry_date}
                          {days !== null && ` (${days < 0 ? "expired" : `${days} days`})`}
                        </span>
                      )}
                    </div>
                    {cred.notes && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{cred.notes}</p>}
                  </div>
                  <button onClick={() => deleteCred(cred.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DOCUMENTS TAB */}
      {activeTab === "documents" && (
        <div className="space-y-3">
          {documents.length === 0 && !loading && (
            <Section title="No Documents Yet">
              <p className="text-gray-400 text-sm">Click "+ Upload Document" to add credential documents.</p>
            </Section>
          )}
          {documents.map((doc) => {
            const days = daysUntilExpiry(doc.expiry_date);
            return (
              <div key={doc.id} className={`border rounded-xl p-4 bg-white ${days !== null && days < 0 ? "border-red-200" : days !== null && days <= 30 ? "border-orange-200" : "border-gray-100"}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{doc.document_name}</p>
                      {doc.document_type && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{doc.document_type}</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      {doc.credential_number && <span>#{doc.credential_number}</span>}
                      {doc.issuing_body && <span>{doc.issuing_body}</span>}
                      {doc.issue_date && <span>Issued: {doc.issue_date}</span>}
                      {doc.expiry_date && (
                        <span className={expiryColor(days)}>
                          Expires: {doc.expiry_date}
                          {days !== null && ` (${days < 0 ? "expired" : `${days} days`})`}
                        </span>
                      )}
                    </div>
                    {doc.notes && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{doc.notes}</p>}
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline mt-1 inline-flex items-center gap-1">
                        📄 {doc.file_name ?? "View Document"} →
                      </a>
                    )}
                  </div>
                  <button onClick={() => deleteDoc(doc.id)} className="text-gray-300 hover:text-red-400 text-xs ml-2">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}