"use client";

export default function HistoryPage() {
  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">
        History
      </h2>

      <p className="text-gray-600 mb-6">
        Filter and review previous notes, behavior data, and skill programs.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <input
          type="text"
          placeholder="Filter by Client"
          className="border rounded-lg p-3"
        />

        <input
          type="date"
          className="border rounded-lg p-3"
        />

        <select
          className="border rounded-lg p-3 bg-white"
          defaultValue=""
        >
          <option value="" disabled>
            All Types
          </option>

          <option>Session Notes</option>
          <option>Behavior Interventions</option>
          <option>Skill Programs</option>
          <option>Client Profiles</option>
        </select>

        <input
          type="text"
          placeholder="Filter by Staff"
          className="border rounded-lg p-3"
        />
      </div>

      <div className="mt-6 border rounded-xl p-4 bg-gray-50">
        <p className="text-gray-500">
          Previous records and activity history will appear here.
        </p>
      </div>
    </div>
  );
}