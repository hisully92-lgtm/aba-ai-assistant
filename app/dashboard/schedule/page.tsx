"use client";

export default function SchedulePage() {
  return (
    <div className="space-y-6">

      <div className="bg-white rounded-2xl shadow p-6 border">
        <h1 className="text-3xl font-bold mb-2">
          Schedule
        </h1>

        <p className="text-gray-600">
          Organize sessions, staff assignments, locations, and learner schedules.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 border">
        <h2 className="text-2xl font-bold mb-4">
          Schedule Session
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <input type="text" placeholder="Client Name" className="border rounded-lg p-3" />
          <input type="text" placeholder="Staff Member" className="border rounded-lg p-3" />
          <input type="date" className="border rounded-lg p-3" />
          <input type="time" className="border rounded-lg p-3" />
          <input type="text" placeholder="Location" className="border rounded-lg p-3" />
          <input type="text" placeholder="Session Duration" className="border rounded-lg p-3" />

        </div>

        <textarea
          placeholder="Session Notes or Reminders"
          className="border rounded-lg p-3 min-h-[120px] w-full mt-4"
        />

        <button className="bg-black text-white rounded-lg p-3 font-medium mt-4">
          Save Schedule
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 border">
        <h2 className="text-2xl font-bold mb-4">
          Upcoming Sessions
        </h2>

        <p className="text-gray-500">
          Scheduled sessions and calendar events will appear here.
        </p>
      </div>

    </div>
  );
}