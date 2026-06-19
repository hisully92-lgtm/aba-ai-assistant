import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { companyId, name, address, city, state, zip, phone, lat, lng, radius, createdBy } = body;

    if (!companyId || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from("locations").insert([{
      company_id: companyId,
      name,
      address: address || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      phone: phone || null,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      radius: radius ? parseInt(radius) : 300,
      is_active: true,
      created_by: createdBy || null,
    }]).select().maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
