export default function ClientOverview({ client }: any) {
  if (!client) return <p>No client</p>;

  return (
    <div>
      <h2>{client.name}</h2>
      <p>{client.age}</p>
      <p>{client.diagnosis}</p>
    </div>
  );
}