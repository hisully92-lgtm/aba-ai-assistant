import { NextResponse } from "next/server";
import { getSwaggerSpec } from "@/lib/swagger/config";

export async function GET() {
  const spec = getSwaggerSpec();
  return NextResponse.json(spec);
}