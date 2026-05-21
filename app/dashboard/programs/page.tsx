"use client";

export default function ProgramsPage() {
  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">
        Skill Programs
      </h2>

      <p className="text-gray-600 mb-6">
        Create teaching programs with targets, prompting, mastery criteria, trial data, and notes.
      </p>

      <div className="flex flex-col gap-4">

        <input type="text" placeholder="Staff Member" className="border rounded-lg p-3" />
        <input type="text" placeholder="Program Name" className="border rounded-lg p-3" />

        <textarea placeholder="Goal" className="border rounded-lg p-3 min-h-[100px]" />
        <textarea placeholder="Targets" className="border rounded-lg p-3 min-h-[100px]" />

        <input type="text" placeholder="Prompt Level" className="border rounded-lg p-3" />
        <input type="text" placeholder="Mastery Criteria" className="border rounded-lg p-3" />

        <textarea placeholder="Trial Data" className="border rounded-lg p-3 min-h-[120px]" />
        <textarea placeholder="Notes" className="border rounded-lg p-3 min-h-[120px]" />

        <div className="border rounded-xl p-4 bg-gray-50">
          <h3 className="font-bold text-lg mb-2">Graph</h3>
          <p className="text-gray-600">
            Graphing will be added later. For now, enter trial data above.
          </p>
        </div>

        <button className="bg-black text-white rounded-lg p-3 font-medium">
          Save Skill Program
        </button>

      </div>
    </div>
  );
}