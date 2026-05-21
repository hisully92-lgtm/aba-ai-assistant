export default function Sidebar() {
  return (
    <div className="w-64 p-4 border-r">
      <nav className="flex flex-col gap-2">
        <a href="/dashboard">Dashboard</a>
        <a href="/dashboard/clients">Clients</a>
        <a href="/dashboard/sessions">Sessions</a>
        <a href="/dashboard/reports">Reports</a>
      </nav>
    </div>
  );
}