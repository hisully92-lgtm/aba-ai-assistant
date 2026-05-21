import Card from "../ui/Card";

type Client = {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
};

type ClientOverviewProps = {
  client: Client | null;
};

export default function ClientOverview({ client }: ClientOverviewProps) {
  if (!client) {
    return (
      <Card>
        <p>No client selected</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 style={{ marginBottom: 12 }}>Client Overview</h2>

      <p>
        <strong>Name:</strong> {client.name}
      </p>

      <p>
        <strong>Age:</strong> {client.age}
      </p>

      <p>
        <strong>Diagnosis:</strong> {client.diagnosis}
      </p>

      <hr style={{ margin: "16px 0" }} />

      <p style={{ fontSize: 14, color: "#666" }}>
        This section will later include:
      </p>

      <ul style={{ fontSize: 14, color: "#666" }}>
        <li>Active programs</li>
        <li>Recent session notes</li>
        <li>Behavior data summary</li>
        <li>Progress graphs</li>
      </ul>
    </Card>
  );
}