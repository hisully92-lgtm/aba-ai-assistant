"use client";

export default function ClientsPage() {
  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">
        Clients/Learners
      </h2>

      <p className="text-gray-600 mb-6">
        Create and manage learner profiles for goals, behaviors, programs, and session history.
      </p>

      <div className="flex flex-col gap-4">

        <input
          type="text"
          placeholder="Client Name"
          className="border rounded-lg p-3"
        />

        <input
          type="date"
          className="border rounded-lg p-3"
        />

        <input
          type="text"
          placeholder="Diagnosis"
          className="border rounded-lg p-3"
        />

        <input
          type="text"
          placeholder="Caregiver Name"
          className="border rounded-lg p-3"
        />

        <textarea
          placeholder="Goals"
          className="border rounded-lg p-3 min-h-[100px]"
        />

        <textarea
          placeholder="Behaviors"
          className="border rounded-lg p-3 min-h-[100px]"
        />

        <textarea
          placeholder="Skill Programs"
          className="border rounded-lg p-3 min-h-[120px]"
        />

        <button className="bg-black text-white rounded-lg p-3 font-medium">
          Save Client
        </button>

      </div>
    </div>
  );
}