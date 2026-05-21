import Link from "next/link";

export default function Sidebar() {
  return (
    <nav
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 20,
        minWidth: 220,
        borderRight: "1px solid #ddd",
        backgroundColor: "#f8f8f8",
      }}
    >
      <h2>ABA AI</h2>

      <Link href="/dashboard">Dashboard</Link>

      <Link href="/dashboard/clients">
        Clients
      </Link>

      <Link href="/dashboard/sessions">
        Sessions
      </Link>

      <Link href="/dashboard/behaviors">
        Behaviors
      </Link>

      <Link href="/dashboard/programs">
        Programs
      </Link>

      <Link href="/dashboard/reports">
        Reports
      </Link>

      <Link href="/dashboard/schedule">
        Schedule
      </Link>

      <Link href="/dashboard/settings">
        Settings
      </Link>
    </nav>
  );
}