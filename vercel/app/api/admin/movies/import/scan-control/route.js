import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import {
  getMovieImportScanSession,
  pauseMovieImportScanSession,
  resumeMovieImportScanSession,
  stopMovieImportScanSession,
} from "../../../../../../lib/movieImportScanSessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const sessionId = String(body?.session_id || "").trim();
  const action = String(body?.action || "").trim().toLowerCase();

  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required." }, { status: 400 });
  }

  const existing = getMovieImportScanSession(sessionId);
  if (!existing) {
    return NextResponse.json({ error: "Scan session not found." }, { status: 404 });
  }

  let session = null;
  if (action === "pause") {
    session = pauseMovieImportScanSession(sessionId);
  } else if (action === "resume") {
    session = resumeMovieImportScanSession(sessionId);
  } else if (action === "stop") {
    session = stopMovieImportScanSession(sessionId);
  } else {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  if (!session) {
    return NextResponse.json({ error: "Unable to update scan session." }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    session_id: session.id,
    paused: Boolean(session.paused),
    stopped: Boolean(session.stopped),
    ended: Boolean(session.ended),
  });
}
