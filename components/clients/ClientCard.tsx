import Link from "next/link";
import Card from "../ui/Card";
import ExportClientButton from "@/components/clients/ExportClientButton";

type Client = {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
};

export default function ClientCard({ client }: { client: Client }) {
  return (
    <Card>
      <h3 className="font-bold">{client.name}</h3>
      <p>Age: {client.age}</p>
      <p>{client.diagnosis}</p>

      <Link href={`/dashboard/clients/${client.id}`}>
        View
      </Link>
    </Card>
  );
}