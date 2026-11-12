import { NextResponse } from "next/server";
import { requireClientOrPublicReadApi } from "../../../../lib/clientApi";
import { getRadioStations } from "../../../../lib/radioData";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireClientOrPublicReadApi();
  if (!auth.ok) return auth.response;
  const stations = await getRadioStations().catch(() => []);
  return NextResponse.json({ stations });
}
