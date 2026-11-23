import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const maxBytes = 500 * 1024 * 1024;

const audioExtensions: Record<string, string> = {
  aac: "audio/aac",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  caf: "audio/x-caf",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  wave: "audio/wav",
};

export async function signAudioUpload(showId: string, fileName: string, contentType: string, size: number) {
  if (!showIdPattern.test(showId)) return { error: "That show is missing." };
  if (!Number.isFinite(size) || size <= 0) return { error: "Choose an audio file." };
  if (size > maxBytes) return { error: "That file is larger than 500 MB." };

  const safeName = safeFileName(fileName);
  const type = audioType(safeName, contentType);
  if (!type) return { error: "Choose an audio file." };

  const storage = client();
  if (!storage) return { error: "Audio storage isn't set up yet." };

  const key = `shows/${showId}/${crypto.randomUUID()}/${safeName}`;
  const url = await getSignedUrl(
    storage.s3,
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      ContentType: type,
    }),
    { expiresIn: 600 },
  );
  return { url, key, contentType: type };
}

export async function signAudioRead(showId: string, key: string) {
  if (ownedAudioKey(showId, key) !== key) return { error: "That audio file is missing." };
  const storage = client();
  if (!storage) return { error: "Audio storage isn't set up yet." };
  const url = await getSignedUrl(storage.s3, new GetObjectCommand({ Bucket: storage.bucket, Key: key }), { expiresIn: 600 });
  return { url };
}

export async function bucketAudioBytes() {
  const storage = client();
  if (!storage) return null;
  let total = 0;
  let token: string | undefined;
  do {
    const page = await storage.s3.send(
      new ListObjectsV2Command({
        Bucket: storage.bucket,
        ContinuationToken: token,
      }),
    );
    for (const item of page.Contents ?? []) total += item.Size ?? 0;
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return total;
}

export async function storedAudioBytes(prefixes: string[]) {
  const storage = client();
  if (!storage) return null;
  let total = 0;
  for (const prefix of prefixes) {
    if (!prefix.startsWith("shows/")) continue;
    let token: string | undefined;
    do {
      const page = await storage.s3.send(
        new ListObjectsV2Command({
          Bucket: storage.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      for (const item of page.Contents ?? []) total += item.Size ?? 0;
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
  return total;
}

const cueAudioKey = /^cues\/[0-9a-f]{64}$/;

export async function readCueAudio(key: string) {
  if (!cueAudioKey.test(key)) return null;
  const storage = client();
  if (!storage) return null;
  try {
    const result = await storage.s3.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }));
    if (!result.Body) return null;
    const bytes = await result.Body.transformToByteArray();
    return { body: Buffer.from(bytes), contentType: result.ContentType || "application/octet-stream" };
  } catch (error) {
    if (missingObject(error)) return null;
    throw error;
  }
}

export async function writeCueAudio(key: string, body: Buffer, contentType: string) {
  if (!cueAudioKey.test(key)) return false;
  const storage = client();
  if (!storage) return false;
  await storage.s3.send(
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return true;
}

export async function saveAudio(showId: string, key: string, destination: string) {
  if (ownedAudioKey(showId, key) !== key) return false;
  const storage = client();
  if (!storage) return false;
  const result = await storage.s3.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }));
  if (!result.Body) return false;
  const web = result.Body.transformToWebStream() as import("node:stream/web").ReadableStream;
  await pipeline(Readable.fromWeb(web), createWriteStream(destination));
  return true;
}

export function ownedAudioKey(showId: string, value: FormDataEntryValue | null) {
  const key = String(value ?? "").trim();
  if (!key) return null;
  const pattern = new RegExp(`^shows/${showId}/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,180}$`, "i");
  return pattern.test(key) ? key : undefined;
}

const showIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function missingObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const status = "$metadata" in error && error.$metadata && typeof error.$metadata === "object" && "httpStatusCode" in error.$metadata ? Number(error.$metadata.httpStatusCode) : 0;
  return name === "NotFound" || name === "NoSuchKey" || status === 404;
}

function client() {
  const account = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!account || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    bucket,
    s3: new S3Client({
      region: "auto",
      endpoint: `https://${account}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
}

function audioType(fileName: string, contentType: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const fromName = audioExtensions[extension];
  const type = contentType.toLowerCase();
  if (type.startsWith("audio/")) return type;
  if (fromName && (type === "" || type === "application/octet-stream" || type === "video/mp4")) return fromName;
  return null;
}

function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "audio";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned.slice(0, 180) || "audio";
}
