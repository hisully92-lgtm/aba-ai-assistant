type Props = {
  name: string;
  setName: (v: string) => void;
  age: string;
  setAge: (v: string) => void;
  diagnosis: string;
  setDiagnosis: (v: string) => void;
  onSubmit: () => void;
};

export default function ClientForm({
  name,
  setName,
  age,
  setAge,
  diagnosis,
  setDiagnosis,
  onSubmit,
}: Props) {
  return (
    <div className="space-y-2">
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="Age"
        value={age}
        onChange={(e) => setAge(e.target.value)}
      />

      <input
        placeholder="Diagnosis"
        value={diagnosis}
        onChange={(e) => setDiagnosis(e.target.value)}
      />

      <button onClick={onSubmit}>Save</button>
    </div>
  );
}