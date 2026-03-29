import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSupabaseAdmin } from "./supabaseAdmin";

function cleanText(value) {
  return String(value || "").trim();
}

function cleanBool(value, fallback = false) {
  const text = cleanText(value).toLowerCase();
  if (!text) return fallback;
  return !["0", "false", "no", "off"].includes(text);
}

export function getObjectStorageProvider() {
  const provider = cleanText(process.env.OBJECT_STORAGE_PROVIDER || "supabase").toLowerCase();
  return provider === "s3" || provider === "s3-compatible" ? "s3" : "supabase";
}

function getS3Config() {
  return {
    endpoint: cleanText(process.env.OBJECT_STORAGE_ENDPOINT),
    region: cleanText(process.env.OBJECT_STORAGE_REGION || "us-east-1") || "us-east-1",
    accessKeyId: cleanText(process.env.OBJECT_STORAGE_ACCESS_KEY),
    secretAccessKey: cleanText(process.env.OBJECT_STORAGE_SECRET_KEY),
    publicBaseUrl: cleanText(process.env.OBJECT_STORAGE_PUBLIC_BASE_URL),
    forcePathStyle: cleanBool(process.env.OBJECT_STORAGE_USE_PATH_STYLE, true),
    signedReadUrls: cleanBool(process.env.OBJECT_STORAGE_SIGNED_READ_URLS, true),
    signedReadExpirySeconds: Number(cleanText(process.env.OBJECT_STORAGE_SIGNED_READ_EXPIRY_SECONDS) || 86400) || 86400,
  };
}

function assertS3Config(config) {
  if (!config.endpoint) throw new Error("OBJECT_STORAGE_ENDPOINT is required for S3-compatible storage.");
  if (!config.accessKeyId) throw new Error("OBJECT_STORAGE_ACCESS_KEY is required for S3-compatible storage.");
  if (!config.secretAccessKey) throw new Error("OBJECT_STORAGE_SECRET_KEY is required for S3-compatible storage.");
}

function getS3Client() {
  const config = getS3Config();
  assertS3Config(config);
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function getS3ClientSafe() {
  return getS3Client();
}

function joinUrl(base, path) {
  return `${String(base || "").replace(/\/+$/, "")}/${String(path || "").replace(/^\/+/, "")}`;
}

function buildObjectProxyUrl(bucket, path) {
  return `/api/media/object?bucket=${encodeURIComponent(String(bucket || ""))}&path=${encodeURIComponent(String(path || ""))}`;
}

function buildS3PublicUrl(bucket, key) {
  const config = getS3Config();
  if (config.publicBaseUrl) return joinUrl(config.publicBaseUrl, key);
  if (config.forcePathStyle) return joinUrl(config.endpoint, `${bucket}/${key}`);
  try {
    const url = new URL(config.endpoint);
    return `${url.protocol}//${bucket}.${url.host}/${key}`;
  } catch {
    return joinUrl(config.endpoint, `${bucket}/${key}`);
  }
}

export function buildPublicObjectUrl(bucket, key) {
  const safeBucket = cleanText(bucket);
  const safeKey = cleanText(key);
  if (!safeBucket || !safeKey) return "";

  if (getObjectStorageProvider() === "s3") {
    return buildS3PublicUrl(safeBucket, safeKey);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data } = supabase.storage.from(safeBucket).getPublicUrl(safeKey);
    return cleanText(data?.publicUrl);
  } catch {
    return "";
  }
}

export function resolvePublicObjectUrl({ bucket, path, fallbackUrl = "" }) {
  const safeBucket = cleanText(bucket);
  const safePath = cleanText(path);
  const safeFallbackUrl = cleanText(fallbackUrl);

  if (safeBucket && safePath) {
    return buildPublicObjectUrl(safeBucket, safePath) || safeFallbackUrl;
  }

  return safeFallbackUrl;
}

export async function ensureSupabaseBucket(bucket, options = {}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: Number(options.fileSizeLimit || 5 * 1024 * 1024),
    allowedMimeTypes: Array.isArray(options.allowedMimeTypes) ? options.allowedMimeTypes : undefined,
  });

  const message = String(error?.message || "").toLowerCase();
  const alreadyExists =
    !error ||
    message.includes("already exists") ||
    message.includes("duplicate") ||
    message.includes("exists");

  if (!alreadyExists) {
    throw new Error(`Bucket setup failed: ${error.message}`);
  }
}

export async function uploadPublicObject({ bucket, key, bytes, contentType }) {
  const provider = getObjectStorageProvider();
  if (!bucket) throw new Error("Upload bucket is required.");
  if (!key) throw new Error("Upload key is required.");

  if (provider === "s3") {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType || "application/octet-stream",
      })
    );
    return {
      bucket,
      path: key,
      url: buildS3PublicUrl(bucket, key),
      provider,
    };
  }

  const supabase = getSupabaseAdmin();
  const upload = await supabase.storage.from(bucket).upload(key, bytes, {
    contentType: contentType || "application/octet-stream",
    upsert: true,
  });
  if (upload.error) {
    throw new Error(upload.error.message || "Object upload failed.");
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  const url = data?.publicUrl || "";
  if (!url) throw new Error("Upload succeeded but public URL not available.");

  return {
    bucket,
    path: key,
    url,
    provider,
  };
}

export async function resolveObjectUrl({ bucket, path, fallbackUrl = "" }) {
  const safeBucket = cleanText(bucket);
  const safePath = cleanText(path);
  const safeFallbackUrl = cleanText(fallbackUrl);
  const provider = getObjectStorageProvider();

  if (!safeBucket || !safePath) return safeFallbackUrl;

  if (provider === "s3") {
    const config = getS3Config();
    if (config.signedReadUrls) {
      return buildObjectProxyUrl(safeBucket, safePath);
    }
    if (!config.signedReadUrls) {
      return safeFallbackUrl || buildS3PublicUrl(safeBucket, safePath);
    }
    const client = getS3Client();
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: safeBucket,
        Key: safePath,
      }),
      { expiresIn: Math.max(60, config.signedReadExpirySeconds) }
    );
  }

  return safeFallbackUrl;
}

export async function deletePublicObject({ bucket, path }) {
  if (!bucket || !path) return;
  const provider = getObjectStorageProvider();

  if (provider === "s3") {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: path,
      })
    );
    return;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    throw new Error(error.message || "Object delete failed.");
  }
}
