"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type DayAvailability = { start: string; end: string; available: boolean };
type WeekAvailability = Record<string, DayAvailability>;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const defaultDay: DayAvailability = { start: "09:00", end: "17:00", available: true };
const defaultWeek: WeekAvailability = Object.fromEntries(DAYS.map((d) => [d, { ...defaultDay, available: d !== "Saturday" && d !== "Sunday" }]));

export default function StaffAvailabilityPage() {
  const [availability, setAvailability] = useState<WeekAvailability>(defaultWeek);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("profiles").select("availability").eq("id", user.id).single();

    if (data?.availability && typeof data.availability === "object") {
      setAvailability({ ...defaultWeek, ...(data.availability as WeekAvailability) });
    }
    setLoading(false);
  }

  function toggleDay(day: string) {
    setAvailability((prev) => ({ ...prev, [day]: { ...prev[day], available: !prev[day].available } }));
  }

  function updateTime(day: string, field: "start" | "end", value: string) {
    setAvailability((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    await supabase.from("profiles").update({ availability }).eq("id", user.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  }

  function totalHours() {
    return DAYS.filter((d) => availability[d]?.available).reduce((total, day) => {
      const { start, end } = availability[day];
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      return total + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    }, 0).toFixed(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Availability">
        <p className="text-gray-500 text-sm">Set your weekly availability for scheduling.</p>
      </PageHeader>

      {saved && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">✓ Availability saved.</div>}

      <Section title={`Weekly Schedule — ${totalHours()} hours available`}>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : (
          <div className="space-y-3">
            {DAYS.map((day) => {
              const dayData = availability[day];
              return (
                <div key={day} className={`border rounded-xl p-4 transition-all ${dayData.available ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-gray-50"}`}>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-3 w-36">
                      <button onClick={() => toggleDay(day)}
                        className={`w-10 h-6 rounded-full transition-all relative ${dayData.available ? "bg-blue-500" : "bg-gray-300"}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${dayData.available ? "left-5" : "left-1"}`} />
                      </button>
                      <span className={`text-sm font-medium ${dayData.available ? "text-gray-800" : "text-gray-400"}`}>{day}</span>
                    </div>
                    {dayData.available ? (
                      <div className="flex items-center gap-3">
                        <input type="time" value={dayData.start} onChange={(e) => updateTime(day, "start", e.target.value)}
                          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        <span className="text-gray-400 text-sm">to</span>
                        <input type="time" value={dayData.end} onChange={(e) => updateTime(day, "end", e.target.value)}
                          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        <span className="text-xs text-blue-600 font-medium">
                          {(() => {
                            const [sh, sm] = dayData.start.split(":").map(Number);
                            const [eh, em] = dayData.end.split(":").map(Number);
                            const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                            return `${hours}h`;
                          })()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Not available</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4">
          <Button onClick={handleSave} loading={saving}>Save Availability</Button>
        </div>
      </Section>
    </div>
  );
}