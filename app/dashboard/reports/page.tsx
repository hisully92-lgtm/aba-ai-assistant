"use client";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow p-6 border">
        <h1 className="text-3xl font-bold mb-2">Reports</h1>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 border">
        <h2 className="text-2xl font-bold mb-4">Report Builder</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="border p-3 rounded-lg" placeholder="Client" />
          <input type="date" className="border p-3 rounded-lg" />
          <input className="border p-3 rounded-lg" placeholder="Staff" />
          <select className="border p-3 rounded-lg">
            <option>Session</option>
            <option>Behavior</option>
            <option>Skill</option>
          </select>
        </div>

        <textarea className="border p-3 rounded-lg w-full mt-4" />

        <button className="bg-black text-white rounded-lg p-3 mt-4">
          Generate Report
        </button>
      </div>
    </div>
  );
}