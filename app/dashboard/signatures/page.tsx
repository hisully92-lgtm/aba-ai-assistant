"use client";

import { useRef, useState } from "react";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type SignatureData = {
  name: string;
  role: string;
  dataUrl: string;
  timestamp: string;
};

function SignatureCanvas({
  label,
  onSave,
}: {
  label: string;
  onSave: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [saved, setSaved] = useState(false);

  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = "#1a2234";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function stopDraw() { setDrawing(false); }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSaved(false);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
    setSaved(true);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <canvas
        ref={canvasRef}
        width={500}
        height={120}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        className={`border-2 border-dashed rounded-lg bg-gray-50 cursor-crosshair w-full transition-colors ${
          saved ? "border-green-300" : "border-gray-300"
        }`}
      />
      <div className="flex gap-2">
        <Button variant="outline" onClick={clear}>Clear</Button>
        <Button onClick={save}>{saved ? "✓ Saved" : "Save Signature"}</Button>
      </div>
    </div>
  );
}

export default function SignaturesPage() {
  const [providerName, setProviderName] = useState("");
  const [providerRole, setProviderRole] = useState("RBT");
  const [caregiverName, setCaregiverName] = useState("");
  const [caregiverRelationship, setCaregiverRelationship] = useState("Parent");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [providerSig, setProviderSig] = useState<string | null>(null);
  const [caregiverSig, setCaregiverSig] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [savedRecord, setSavedRecord] = useState<{
    provider: SignatureData;
    caregiver: SignatureData;
    date: string;
  } | null>(null);

  const PROVIDER_ROLES = ["BCBA", "Student Analyst", "RBT", "BT"];
  const CAREGIVER_RELATIONSHIPS = ["Parent", "Guardian", "Grandparent", "Foster Parent", "Other"];

  function handleComplete() {
    if (!providerName || !caregiverName || !providerSig || !caregiverSig) return;

    setSavedRecord({
      provider: {
        name: providerName,
        role: providerRole,
        dataUrl: providerSig,
        timestamp: new Date().toISOString(),
      },
      caregiver: {
        name: caregiverName,
        role: caregiverRelationship,
        dataUrl: caregiverSig,
        timestamp: new Date().toISOString(),
      },
      date: sessionDate,
    });
    setCompleted(true);
  }

  function handleReset() {
    setProviderName("");
    setCaregiverName("");
    setProviderSig(null);
    setCaregiverSig(null);
    setCompleted(false);
    setSavedRecord(null);
  }

  const canComplete = providerName && caregiverName && providerSig && caregiverSig;

  return (
    <div className="space-y-6">
      <PageHeader title="Session Signatures">
        <p className="text-gray-500 text-sm">Collect provider and caregiver signatures.</p>
      </PageHeader>

      {completed && savedRecord ? (
        <Section title="✓ Signatures Collected">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-700">Provider</p>
                <p className="text-sm text-gray-700 mt-1">{savedRecord.provider.name}</p>
                <p className="text-xs text-gray-500">{savedRecord.provider.role}</p>
                <img src={savedRecord.provider.dataUrl} alt="Provider signature" className="border rounded bg-white p-2 mt-2 max-w-full" />
              </div>
              <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-700">Caregiver</p>
                <p className="text-sm text-gray-700 mt-1">{savedRecord.caregiver.name}</p>
                <p className="text-xs text-gray-500">{savedRecord.caregiver.role}</p>
                <img src={savedRecord.caregiver.dataUrl} alt="Caregiver signature" className="border rounded bg-white p-2 mt-2 max-w-full" />
              </div>
            </div>
            <p className="text-xs text-gray-400">Session Date: {savedRecord.date} · Signed: {new Date(savedRecord.provider.timestamp).toLocaleString()}</p>
            <Button variant="outline" onClick={handleReset}>Collect New Signatures</Button>
          </div>
        </Section>
      ) : (
        <>
          {/* SESSION INFO */}
          <Section title="Session Information">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
          </Section>

          {/* PROVIDER SIGNATURE */}
          <Section title="Provider Signature">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Provider Name *</label>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="Full name"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Provider Role</label>
                <select
                  value={providerRole}
                  onChange={(e) => setProviderRole(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  {PROVIDER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <SignatureCanvas label="Sign below:" onSave={setProviderSig} />
            {providerSig && <p className="text-xs text-green-600 mt-1">✓ Provider signature captured</p>}
          </Section>

          {/* CAREGIVER SIGNATURE */}
          <Section title="Caregiver Signature">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Caregiver Name *</label>
                <input
                  type="text"
                  value={caregiverName}
                  onChange={(e) => setCaregiverName(e.target.value)}
                  placeholder="Full name of caregiver who signed"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Relationship</label>
                <select
                  value={caregiverRelationship}
                  onChange={(e) => setCaregiverRelationship(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  {CAREGIVER_RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <SignatureCanvas label="Caregiver signs below:" onSave={setCaregiverSig} />
            {caregiverSig && <p className="text-xs text-green-600 mt-1">✓ Caregiver signature captured</p>}
          </Section>

          {/* COMPLETE */}
          <div className="flex gap-2">
            <Button
              onClick={handleComplete}
              disabled={!canComplete}
            >
              Complete & Save Signatures
            </Button>
            {!canComplete && (
              <p className="text-xs text-gray-400 self-center">
                Both names and signatures required
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}