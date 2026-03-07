import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { getMovieMetadataSettingsPublic, saveMovieMetadataSettings } from "../../../../lib/movieMetadataSettings";

function parseKeys(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[,\n\r]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const settings = await getMovieMetadataSettingsPublic();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to load movie metadata settings." }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  try {
    await saveMovieMetadataSettings({
      adminUserId: auth.current.user.id,
      patch: {
        omdb_api_keys: parseKeys(body?.omdb_api_keys),
      },
    });
    const settings = await getMovieMetadataSettingsPublic();
    return NextResponse.json({ ok: true, ...settings });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to save movie metadata settings." }, { status: 500 });
  }
}
