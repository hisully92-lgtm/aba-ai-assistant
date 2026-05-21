"use client";

export default function ReportsPage() {
  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="bg-white rounded-2xl shadow p-6 border">
        <h1 className="text-3xl font-bold mb-2">
          Reports
        </h1>

        <p className="text-gray-600">
          Generate ABA reports, review progress summaries, and organize clinical documentation.
        </p>
      </div>

      {/* BUILDER */}
      <div className="bg-white rounded-2xl shadow p-6 border">
        <h2 className="text-2xl font-bold mb-4">
          Report Builder
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <input type="text" placeholder="Client Name" className="border rounded-lg p-3" />
          <input type="date" className="border rounded-lg p-3" />

          <select className="border rounded-lg p-3 bg-white">
            <option value="">Select Report Type</option>
            <option>Session Summary</option>
            <option>Behavior Report</option>
            <option>Skill Acquisition Report</option>
            <option>Progress Summary</option>
          </select>

          <input type="text" placeholder="Staff Member" className="border rounded-lg p-3" />
        </div>

        <textarea
          placeholder="Report Notes"
          className="border rounded-lg p-3 min-h-[150px] w-full mt-4"
        />

        <button className="bg-black text-white rounded-lg p-3 font-medium mt-4">
          Generate Report
        </button>
      </div>

      {/* HISTORY */}
      <div className="bg-white rounded-2xl shadow p-6 border">
        <h2 className="text-2xl font-bold mb-4">
          Previous Reports
        </h2>

        <p className="text-gray-500">
          Saved reports and exported documents will appear here.
        </p>
      </div>

    </div>
  );
}