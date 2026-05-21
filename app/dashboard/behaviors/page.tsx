"use client";

export default function BehaviorsPage() {
  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">
        Behavior Interventions
      </h2>

      <p className="text-gray-600 mb-6">
        Collect behavior data and generate intervention recommendations from ABC details.
      </p>

      <div className="flex flex-col gap-4">

        <input
          type="text"
          placeholder="Staff Member"
          className="border rounded-lg p-3"
        />

        <input
          type="text"
          placeholder="Behavior Name"
          className="border rounded-lg p-3"
        />

        <textarea
          placeholder="Antecedent"
          className="border rounded-lg p-3 min-h-[100px]"
        />

        <textarea
          placeholder="Behavior"
          className="border rounded-lg p-3 min-h-[100px]"
        />

        <textarea
          placeholder="Consequence"
          className="border rounded-lg p-3 min-h-[100px]"
        />

        <input
          type="text"
          placeholder="Frequency"
          className="border rounded-lg p-3"
        />

        <input
          type="text"
          placeholder="Duration"
          className="border rounded-lg p-3"
        />

        <input
          type="text"
          placeholder="Intensity"
          className="border rounded-lg p-3"
        />

        <textarea
          placeholder="Function Hypothesis"
          className="border rounded-lg p-3 min-h-[100px]"
        />

        <textarea
          placeholder="Intervention Used"
          className="border rounded-lg p-3 min-h-[100px]"
        />

        <textarea
          placeholder="Replacement Behavior"
          className="border rounded-lg p-3 min-h-[100px]"
        />

        <button className="bg-black text-white rounded-lg p-3 font-medium">
          Generate Intervention Plan
        </button>

      </div>
    </div>
  );
}