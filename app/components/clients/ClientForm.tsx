"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

type Client = {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
};

export default function ClientForm({
  onAdd,
}: {
  onAdd: (client: Client) => void;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  function handleSubmit() {
    if (!name || !age || !diagnosis) return;

    const newClient: Client = {
      id: Date.now().toString(),
      name,
      age: Number(age),
      diagnosis,
    };

    onAdd(newClient);

    setName("");
    setAge("");
    setDiagnosis("");
  }

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        display: "grid",
        gap: 12,
        maxWidth: 400,
      }}
    >
      <input
        placeholder="Client Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          padding: 10,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />

      <input
        placeholder="Age"
        value={age}
        onChange={(e) => setAge(e.target.value)}
        style={{
          padding: 10,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />

      <input
        placeholder="Diagnosis"
        value={diagnosis}
        onChange={(e) => setDiagnosis(e.target.value)}
        style={{
          padding: 10,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />

      <button
        onClick={handleSubmit}
        style={{
          padding: 12,
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
        }}
      >
        Save Client
      </button>
    </div>
  );
}