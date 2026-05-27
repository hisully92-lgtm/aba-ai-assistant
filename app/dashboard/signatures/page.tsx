"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Session = {
  id: string;
  client_id: string;
  date: string;
  status: string;
  created_at: string;
};
type Client = { id: string; full_name: string };
type Profile = { id: string; full_name: string | null; role: string | null };
type Signature = {
  id: string;
  session_id: string;
  rbt_id: string | null;
  bcba_id: string | null;
  rbt_signed: boolean;
  rbt_signed_at: string | null;
  bcba_signed: boolean;
  bcba_signed_at: string | null;
  status: string;
};

export default function SignaturesPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [signatures, setSignatures] = useState<Record<string, Signature>>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [signing, setSigning] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("pending_rbt");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [activeSignSession, setActiveSignSession] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const [{ data: profileData }, { data: clientData }, { data: sessionData }, { data: sigData }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single(),
      supabase.from("clients").select("id, full_name"),
      supabase.from("sessions").select("id, client_id, date, status, created_at").eq("created_by", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("session_signatures").select("*").eq("created_by", user.id),
    ]);

    setUserRole((profileData as any)?.role ?? null);
    setClients(clientData ?? []);
    setSessions(sessionData ?? []);

    const sigMap: Record<string, Signature> = {};
    (sigData ?? []).forEach((s: any) => { sigMap[s.session_id] = s; });
    setSignatures(sigMap);

    const { data: allProfiles } = await supabase.from("profiles").select("id, full_name, role");
    setProfiles(allProfiles ?? []);
    setLoading(false);
  }

  async function createSignature(sessionId: string) {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("session_signatures").insert([{
      session_id: sessionId,
      rbt_id: user.id,
      status: "pending_rbt",
      created_by: user.id,
    }]).select().single();

    if (data) setSignatures((prev) => ({ ...prev, [sessionId]: data }));
  }

  async function signAsRBT(sessionId: string) {
    setSigning(sessionId);
    const sig = signatures[sessionId];
    const signatureData = getSignatureData();

    if (sig) {
      const { data } = await supabase.from("session_signatures").update({
        rbt_signed: true,
        rbt_signed_at: new Date().toISOString(),
        rbt_signature_data: signatureData,
        status: "pending_bcba",
      }).eq("id", sig.id).select().single();
      if (data) setSignatures((prev) => ({ ...prev, [sessionId]: data }));
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const { data } = await supabase.from("session_signatures").insert([{
        session_id: sessionId,
        rbt_id: user.id,
        rbt_signed: true,
        rbt_signed_at: new Date().toISOString(),
        rbt_signature_data: signatureData,
        status: "pending_bcba",
        created_by: user.id,
      }]).select().single();
      if (data) setSignatures((prev) => ({ ...prev, [sessionId]: data }));
    }

    setActiveSignSession(null);
    clearCanvas();
    setSigning(null);
  }

  async function signAsBCBA(sessionId: string) {
    setSigning(sessionId);
    const sig = signatures[sessionId];
    if (!sig) return;

    const signatureData = getSignatureData();
    const { data } = await supabase.from("session_signatures").update({
      bcba_signed: true,
      bcba_signed_at: new Date().toISOString(),
      bcba_signature_data: signatureData,
      status: "complete",
    }).eq("id", sig.id).select().single();

    if (data) setSignatures((prev) => ({ ...prev, [sessionId]: data }));
    setActiveSignSession(null);
    clearCanvas();
    setSigning(null);
  }

  function getSignatureData(): string {
    return canvasRef.current?.toDataURL() ?? "";
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    setDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1a2234";
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? "Unknown"]));

  const filtered = sessions.filter((s) => {
    const sig = signatures[s.id];
    if (filterStatus === "pending_rbt") return !sig || sig.status === "pending_rbt";
    if (filterStatus === "pending_bcba") return sig?.status === "pending_bcba";
    if (filterStatus === "complete") return sig?.status === "complete";
    return true;
  });

  const pendingRBT = sessions.filter((s) => { const sig = signatures[s.id]; return !sig || sig.status === "pending_rbt"; }).length;
  const pendingBCBA = sessions.filter((s) => signatures[s.id]?.status === "pending_bcba").length;
  const complete = sessions.filter((s) => signatures[s.id]?.status === "complete").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Session Signatures">
        <p className="text-gray-500 text-sm">RBT signs first, BCBA countersigns to complete.</p>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-yellow-600">{pendingRBT}</p>
          <p className="text-xs text-gray-500 mt-1">Pending RBT</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-blue-600">{pendingBCBA}</p>
          <p className="text-xs text-gray-500 mt-1">Pending BCBA</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">{complete}</p>
          <p className="text-xs text-gray-500 mt-1">Complete</p>
        </div>
      </div>

      {/* SIGNATURE PAD */}
      {activeSignSession && (
        <Section title="Sign Session Note">
          <p className="text-sm text-gray-600 mb-3">Draw your signature below:</p>
          <canvas
            ref={canvasRef}
            width={500}
            height={150}
            className="border-2 border-gray-300 rounded-xl w-full touch-none bg-white cursor-crosshair"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={() => setDrawing(false)}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={() => setDrawing(false)}
          />
          <div className="flex gap-2 mt-3">
            {(userRole === "rbt" || userRole === "bt" || userRole === "clinician") && (
              <Button onClick={() => signAsRBT(activeSignSession)} loading={signing === activeSignSession}>
                ✍️ Sign as RBT/Therapist
              </Button>
            )}
            {(userRole === "supervisor" || userRole === "admin" || userRole === "director" || userRole === "developer") && (
              <Button onClick={() => signAsBCBA(activeSignSession)} loading={signing === activeSignSession}>
                ✍️ Countersign as BCBA
              </Button>
            )}
            <Button variant="outline" onClick={clearCanvas}>Clear</Button>
            <Button variant="outline" onClick={() => { setActiveSignSession(null); clearCanvas(); }}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER */}
      <div className="flex gap-2">
        {["all", "pending_rbt", "pending_bcba", "complete"].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      <div className="space-y-3">
        {filtered.map((session) => {
          const sig = signatures[session.id];
          return (
            <div key={session.id} className={`border rounded-xl p-4 bg-white ${sig?.status === "complete" ? "border-green-200" : sig?.status === "pending_bcba" ? "border-blue-200" : "border-yellow-200"}`}>
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-gray-800">{clientMap.get(session.client_id) ?? "Unknown"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{session.date ?? new Date(session.created_at).toLocaleDateString()}</p>
                  <div className="flex gap-3 mt-2">
                    <div className={`flex items-center gap-1 text-xs ${sig?.rbt_signed ? "text-green-600" : "text-gray-400"}`}>
                      <span>{sig?.rbt_signed ? "✓" : "○"}</span>
                      <span>RBT {sig?.rbt_signed ? `(${new Date(sig.rbt_signed_at!).toLocaleDateString()})` : "— Pending"}</span>
                    </div>
                    <div className={`flex items-center gap-1 text-xs ${sig?.bcba_signed ? "text-green-600" : "text-gray-400"}`}>
                      <span>{sig?.bcba_signed ? "✓" : "○"}</span>
                      <span>BCBA {sig?.bcba_signed ? `(${new Date(sig.bcba_signed_at!).toLocaleDateString()})` : "— Pending"}</span>
                    </div>
                  </div>
                </div>
                {sig?.status !== "complete" && (
                  <Button variant="outline" onClick={() => setActiveSignSession(session.id)}>
                    ✍️ Sign
                  </Button>
                )}
                {sig?.status === "complete" && (
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">✓ Complete</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}