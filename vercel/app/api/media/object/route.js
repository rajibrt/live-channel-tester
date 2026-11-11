import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import {
  getObjectStorageProvider,
  getPublicMediaBuckets,
  getS3ClientSafe,
  isSafeObjectPath,
} from "../../../../lib/objectStorage";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

function cleanText(value) {
  return String(value || "").trim();
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function GET(request) {
  const url = new URL(request.url);
  const bucket = cleanText(url.searchParams.get("bucket"));
  const path = cleanText(url.searchParams.get("path"));

  if (!bucket || !path) {
    return NextResponse.json({ error: "bucket and path are required" }, { status: 400 });
  }
  if (!getPublicMediaBuckets().has(bucket) || !isSafeObjectPath(path)) {
    return NextResponse.json({ error: "Object not found" }, { status: 404 });
  }

  try {
    if (getObjectStorageProvider() === "s3") {
      const client = getS3ClientSafe();
      const result = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: path,
        })
      );
      const body = await streamToBuffer(result.Body);
      return new NextResponse(body, {
        status: 200,
        headers: {
          "content-type": String(result.ContentType || "application/octet-stream"),
          "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) {
      return NextResponse.json({ error: "Object not found" }, { status: 404 });
    }
    const body = Buffer.from(await data.arrayBuffer());
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": String(data.type || "application/octet-stream"),
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const status = error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404 ? 404 : 500;
    return NextResponse.json({ error: status === 404 ? "Object not found" : "Failed to load object" }, { status });
  }
}

