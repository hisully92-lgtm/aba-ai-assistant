"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import jsPDF from "jspdf";
import Link from "next/link";

type Progress = {
  video_id: string;
  completed: boolean;
  quiz_passed: boolean;
  completed_at: string | null;
};

type Video = {
  id: string;
  title: string;
  section: string;
  duration_seconds: number;
};

type Profile = {
  full_name: string | null;
  email: string | null;
};

export default function TrainingCertificatePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainerName, setTrainerName] = useState("");
  const [trainerCertNumber, setTrainerCertNumber] = useState("");
  const [traineeBACBId, setTraineeBACBId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: videoData }, { data: progressData }, { data: profileData }] = await Promise.all([
      supabase.from("training_videos").select("id, title, section, duration_seconds").eq("is_published", true),
      supabase.from("training_progress").select("*").eq("user_id", user.id),
      supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    ]);

    setVideos(videoData ?? []);
    setProgress(progressData ?? []);
    setProfile(profileData);
    setLoading(false);
  }

  const passedCount = progress.filter(p => p.quiz_passed).length;
  const totalVideos = videos.length;
  const allPassed = totalVideos > 0 && passedCount === totalVideos;

  const completionDates = progress
    .filter(p => p.completed_at)
    .map(p => new Date(p.completed_at!));

  const earliestDate = completionDates.length > 0
    ? new Date(Math.min(...completionDates.map(d => d.getTime())))
    : null;

  const latestDate = completionDates.length > 0
    ? new Date(Math.max(...completionDates.map(d => d.getTime())))
    : null;

  const totalMinutes = videos.reduce((a, b) => a + Math.floor(b.duration_seconds / 60), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  function generateCertificate() {
    if (!profile?.full_name) return;
    setGenerating(true);

    const doc = new jsPDF({ orientation: "landscape" });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    // Background
    doc.setFillColor(26, 34, 52);
    doc.rect(0, 0, w, 20, "F");
    doc.setFillColor(26, 34, 52);
    doc.rect(0, h - 20, w, 20, "F");

    // Side bars
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 8, h, "F");
    doc.rect(w - 8, 0, 8, h, "F");

    // Title
    doc.setTextColor(26, 34, 52);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("CERTIFICATE OF COMPLETION", w / 2, 35, { align: "center" });

    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("BACB 2026 RBT 40-Hour Training Program", w / 2, 45, { align: "center" });

    // Line
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);
    doc.line(40, 52, w - 40, 52);

    // This certifies
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("This certifies that", w / 2, 65, { align: "center" });

    // Trainee name
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 34, 52);
    doc.text(profile.full_name, w / 2, 82, { align: "center" });

    // Underline name
    const nameWidth = doc.getTextWidth(profile.full_name);
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.4);
    doc.line(w / 2 - nameWidth / 2, 85, w / 2 + nameWidth / 2, 85);

    if (traineeBACBId) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(`BACB ID: ${traineeBACBId}`, w / 2, 92, { align: "center" });
    }

    // Description
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(
      "has successfully completed all required training modules and passed all knowledge assessments",
      w / 2, 103, { align: "center" }
    );
    doc.text(
      "for the BACB 2026 RBT 40-Hour Training Requirement.",
      w / 2, 111, { align: "center" }
    );

    // Stats
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text([
      `Training Duration: ${totalHours} hours ${remainingMinutes} minutes`,
      `Modules Completed: ${passedCount} of ${totalVideos}`,
      startDate ? `Training Start Date: ${startDate}` : earliestDate ? `Training Start Date: ${earliestDate.toLocaleDateString()}` : "",
      latestDate ? `Completion Date: ${latestDate.toLocaleDateString()}` : `Completion Date: ${new Date().toLocaleDateString()}`,
    ].filter(Boolean).join("    "), w / 2, 125, { align: "center" });

    // Divider
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(40, 135, w - 40, 135);

    // Signature sections
    const col1 = 60;
    const col2 = w / 2 + 10;
    const sigY = 162;

    // Trainee signature
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Trainee Signature", col1, sigY);
    doc.setDrawColor(26, 34, 52);
    doc.setLineWidth(0.4);
    doc.line(col1, sigY - 12, col1 + 90, sigY - 12);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(profile.full_name, col1, sigY - 15);

    // Trainer info
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Responsible Trainer Signature", col2, sigY);
    doc.setDrawColor(26, 34, 52);
    doc.line(col2, sigY - 12, col2 + 110, sigY - 12);
    if (trainerName) {
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`${trainerName}${trainerCertNumber ? ` · Cert #${trainerCertNumber}` : ""}`, col2, sigY - 15);
    }

    // Disclaimer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "This training program is designed to meet the 2026 training eligibility requirement for RBT certification. This training is offered independent of the BACB.",
      w / 2, h - 25, { align: "center", maxWidth: w - 80 }
    );

    // Header text
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text("ABA AI Practice Management", w / 2, 11, { align: "center" });

    const filename = `RBT-40hr-Certificate-${profile.full_name.replace(/\s/g, "-")}.pdf`;
    doc.save(filename);

    // Save to DB
    supabase.auth.getUser().then(({ data: auth }) => {
      if (auth.user) {
        supabase.from("training_certificates").insert([{
          user_id: auth.user.id,
          issued_at: new Date().toISOString(),
          total_hours: totalHours + remainingMinutes / 60,
          responsible_trainer: trainerName || null,
          trainer_certification_number: trainerCertNumber || null,
          created_by: auth.user.id,
        }]);
      }
    });

    setGenerated(true);
    setGenerating(false);
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Training Certificate" />

      {/* ELIGIBILITY STATUS */}
      <div className={`rounded-2xl p-6 text-center border-2 ${
        allPassed ? "bg-green-50 border-green-300" : "bg-orange-50 border-orange-200"
      }`}>
        <p className="text-5xl mb-3">{allPassed ? "🎓" : "⏳"}</p>
        <p className={`text-xl font-bold mb-1 ${allPassed ? "text-green-700" : "text-orange-700"}`}>
          {allPassed ? "Eligible for Certificate!" : "Training In Progress"}
        </p>
        <p className={`text-sm ${allPassed ? "text-green-600" : "text-orange-600"}`}>
          {allPassed
            ? "You have completed all videos and passed all quizzes."
            : `${passedCount} of ${totalVideos} videos completed with passing quiz scores.`}
        </p>
        {!allPassed && (
          <Link href="/dashboard/training/course">
            <Button className="mt-4">Continue Training →</Button>
          </Link>
        )}
      </div>

      {/* PROGRESS SUMMARY */}
      <Section title="Completion Summary">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {[
            { label: "Videos Passed", value: `${passedCount}/${totalVideos}`, color: "text-green-600" },
            { label: "Training Time", value: `${totalHours}h ${remainingMinutes}m`, color: "text-blue-600" },
            { label: "Sections", value: `${[...new Set(videos.map(v => v.section))].filter(s => videos.filter(v => v.section === s).every(v => progress.find(p => p.video_id === v.id)?.quiz_passed)).length}/8`, color: "text-purple-600" },
          ].map(s => (
            <div key={s.label} className="border rounded-xl p-3 text-center bg-white">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          {["A","B","C","D","E","F","G","H"].map(sec => {
            const secVideos = videos.filter(v => v.section === sec);
            const secPassed = secVideos.filter(v => progress.find(p => p.video_id === v.id)?.quiz_passed).length;
            const complete = secVideos.length > 0 && secPassed === secVideos.length;
            return (
              <div key={sec} className={`flex items-center gap-3 border rounded-lg p-2 text-sm ${complete ? "border-green-200 bg-green-50" : "border-gray-100 bg-white"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${complete ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                  {complete ? "✓" : sec}
                </span>
                <span className={complete ? "text-green-700" : "text-gray-600"}>
                  Section {sec}
                </span>
                <span className="ml-auto text-xs text-gray-400">{secPassed}/{secVideos.length}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* CERTIFICATE FORM */}
      {allPassed && (
        <Section title="Generate Certificate">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-xs text-yellow-700 mb-4">
            <p className="font-bold mb-1">⚠️ Required by BACB</p>
            <p>The Responsible Trainer (BCaBA, BCBA, or BCBA-D with 8-hour supervision training) must review and sign the certificate. Enter their information below before generating.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Your BACB ID</label>
              <input type="text" value={traineeBACBId}
                onChange={(e) => setTraineeBACBId(e.target.value)}
                placeholder="Your BACB applicant ID"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Training Start Date</label>
              <input type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Responsible Trainer Name</label>
              <input type="text" value={trainerName}
                onChange={(e) => setTrainerName(e.target.value)}
                placeholder="BCBA/BCaBA full name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Trainer Certification Number</label>
              <input type="text" value={trainerCertNumber}
                onChange={(e) => setTrainerCertNumber(e.target.value)}
                placeholder="BACB certification number"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <Button
              onClick={generateCertificate}
              loading={generating}
              disabled={!profile?.full_name}
              className="flex-1"
            >
              🎓 Generate Certificate PDF
            </Button>
          </div>

          {generated && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
              ✓ Certificate downloaded! Have your Responsible Trainer sign it and keep a copy for your BACB application.
            </div>
          )}
        </Section>
      )}
    </div>
  );
}