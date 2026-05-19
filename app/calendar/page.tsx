import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { format, startOfWeek, addDays, parseISO } from "date-fns";

type Session = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  color: string;
  clients: { full_name: string } | null;
  locations: { name: string } | null;
  session_staff:
    | { profiles: { full_name: string } | null }[]
    | null;
};

export default async function CalendarPage() {
  // ✅ cookies (App Router safe)
  const cookieStore = cookies();

  // ✅ Supabase SSR client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );

  // ✅ auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in</div>;
  }

  // ✅ fetch sessions
  const { data, error } = await supabase
    .from("sessions")
    .select(`
      id,
      start_time,
      end_time,
      status,
      color,
      clients ( full_name ),
      locations ( name ),
      session_staff ( profiles ( full_name ) )
    `);

  if (error) {
    return <div>Error loading sessions</div>;
  }

  // ✅ clean + safe typing (NO CASTING)
  const sessions: Session[] = data ?? [];

  // ✅ week setup
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const days = Array.from({ length: 7 }, (_, i) =>
    addDays(weekStart, i)
  );

  return (
    <div style={{ padding: "20px" }}>
      <h1>Weekly ABA Calendar</h1>

      {/* WEEK HEADER */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        {days.map((day) => (
          <div
            key={day.toISOString()}
            style={{ flex: 1, fontWeight: "bold" }}
          >
            {format(day, "EEE MM/dd")}
          </div>
        ))}
      </div>

      {/* GRID */}
      <div style={{ display: "flex", gap: "10px" }}>
        {days.map((day) => {
          const daySessions = sessions.filter((s) => {
            if (!s.start_time) return false;

            return (
              format(parseISO(s.start_time), "yyyy-MM-dd") ===
              format(day, "yyyy-MM-dd")
            );
          });

          return (
            <div
              key={day.toISOString()}
              style={{
                flex: 1,
                minHeight: "500px",
                border: "1px solid #ddd",
                padding: "10px",
              }}
            >
              {daySessions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    borderLeft: `4px solid ${s.color || "#999"}`,
                    background: "#f9f9f9",
                    marginBottom: "10px",
                    padding: "8px",
                    borderRadius: "6px",
                  }}
                >
                  <div>
                    <strong>
                      {s.clients?.full_name ?? "No client"}
                    </strong>
                  </div>

                  <div style={{ fontSize: "12px" }}>
                    {s.session_staff?.[0]?.profiles?.full_name ??
                      "No staff"}
                  </div>

                  <div style={{ fontSize: "12px" }}>
                    {format(parseISO(s.start_time), "hh:mm a")} -{" "}
                    {format(parseISO(s.end_time), "hh:mm a")}
                  </div>

                  <div style={{ fontSize: "12px" }}>
                    {s.locations?.name ?? "No location"}
                  </div>

                  <div style={{ fontSize: "12px" }}>
                    {s.status}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}