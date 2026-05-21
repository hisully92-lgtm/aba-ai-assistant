import { useState } from "react";

type Client = {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
};

type Props = {
  onAdd: (client: Client) => void | Promise<void>;
};

export default function ClientForm({ onAdd }: Props) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  function handleSubmit() {
    if (!name || !age || !diagnosis) return;
    onAdd({
      id: crypto.randomUUID(),
      name,
      age: parseInt(age),
      diagnosis,
    });
    setName("");
    setAge("");
    setDiagnosis("");
  }

  return (
    <div className="space-y-2">
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="border p-2 rounded w-full" />
      <input placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} className="border p-2 rounded w-full" />
      <input placeholder="Diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="border p-2 rounded w-full" />
      <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
    </div>
  );
}
