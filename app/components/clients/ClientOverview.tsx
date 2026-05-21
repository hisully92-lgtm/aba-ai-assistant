type Client = {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
};

export default function ClientOverview({ client }: { client: Client | null }) {
  if (!client) return <p>No client selected</p>;

  return (
    <div className="border p-4 rounded">
      <h2 className="font-bold text-xl">{client.name}</h2>
      <p>Age: {client.age}</p>
      <p>Diagnosis: {client.diagnosis}</p>
    </div>
  );
}