import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getPublicArticleBySlug } from "../../../../lib/publicArticles";
import { getObjectStorageProvider, getS3ClientSafe } from "../../../../lib/objectStorage";
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

export async function GET(_request, { params }) {
  const resolved = await params;
  const article = await getPublicArticleBySlug(resolved?.article);

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const bucket = cleanText(article.featuredImageBucket);
  const path = cleanText(article.featuredImagePath);
  const fallbackUrl = cleanText(article.socialImageUrl || article.featuredImageUrl || article.featuredImageFallbackUrl);

  if (bucket && path) {
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
            "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        });
      }

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (!error && data) {
        const body = Buffer.from(await data.arrayBuffer());
        return new NextResponse(body, {
          status: 200,
          headers: {
            "content-type": String(data.type || "application/octet-stream"),
            "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        });
      }
    } catch {
      // fall through to redirect
    }
  }

  if (fallbackUrl) {
    return NextResponse.redirect(fallbackUrl, 302);
  }

  return NextResponse.redirect("/android-chrome-512x512.png", 302);
}
