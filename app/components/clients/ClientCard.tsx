import Link from "next/link";
import Card from "@/components/ui/Card";

type Client = {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
};

export default function ClientCard({ client }: { client: Client }) {
  return (
    <Link
      href={`/dashboard/clients/${client.id}`}
      className="block no-underline text-inherit"
    >
      <Card>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">
            {client.name}
          </h2>

          <p className="text-sm">
            <span className="font-medium">Age:</span>{" "}
            {client.age}
          </p>

          <p className="text-sm">
            <span className="font-medium">Diagnosis:</span>{" "}
            {client.diagnosis}
          </p>
        </div>
      </Card>
    </Link>
  );
}