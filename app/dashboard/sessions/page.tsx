"use client";

export default function SessionsPage() {
  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">
        Session Notes
      </h2>

      <p className="text-gray-600 mb-6">
        Create clear ABA session notes from structured session details.
      </p>

      <div className="flex flex-col gap-4">

        <input type="text" placeholder="Staff Member" className="border rounded-lg p-3" />
        <input type="text" placeholder="Client" className="border rounded-lg p-3" />
        <input type="date" className="border rounded-lg p-3" />
        <input type="text" placeholder="Location" className="border rounded-lg p-3" />
        <input type="text" placeholder="Session Duration" className="border rounded-lg p-3" />

        <textarea placeholder="People Present" className="border rounded-lg p-3 min-h-[80px]" />
        <textarea placeholder="Programs Targeted" className="border rounded-lg p-3 min-h-[100px]" />
        <textarea placeholder="Behaviors Observed" className="border rounded-lg p-3 min-h-[100px]" />
        <textarea placeholder="Interventions Used" className="border rounded-lg p-3 min-h-[100px]" />
        <textarea placeholder="Client Response" className="border rounded-lg p-3 min-h-[100px]" />
        <textarea placeholder="Plan for Next Session" className="border rounded-lg p-3 min-h-[100px]" />

        <button className="bg-black text-white rounded-lg p-3 font-medium">
          Generate Session Note
        </button>

      </div>
    </div>
  );
}