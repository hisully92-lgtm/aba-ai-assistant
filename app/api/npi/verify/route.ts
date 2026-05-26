import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const npi = searchParams.get("npi");
  const name = searchParams.get("name");

  if (!npi && !name) {
    return NextResponse.json({ error: "npi or name parameter required" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      version: "2.1",
      limit: "5",
      ...(npi ? { number: npi } : {}),
      ...(name ? { last_name: name.split(" ").pop() ?? name, taxonomy_description: "behavior" } : {}),
    });

    const response = await fetch(`https://npiregistry.cms.hhs.gov/api/?${params}`);
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: "NPI registry lookup failed" }, { status: 400 });
    }

    const results = (data.results ?? []).map((r: any) => ({
      npi: r.number,
      name: r.basic?.authorized_official_first_name
        ? `${r.basic.authorized_official_first_name} ${r.basic.authorized_official_last_name}`
        : `${r.basic?.first_name ?? ""} ${r.basic?.last_name ?? ""}`.trim(),
      credential: r.basic?.credential ?? "",
      taxonomy: r.taxonomies?.[0]?.desc ?? "",
      status: r.basic?.status ?? "",
      address: r.addresses?.[0]
        ? `${r.addresses[0].address_1}, ${r.addresses[0].city}, ${r.addresses[0].state}`
        : "",
    }));

    return NextResponse.json({ success: true, results, total: data.result_count ?? 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}