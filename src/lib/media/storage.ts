import "server-only";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let client: S3Client | undefined;

function storage() {
  const required = ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_FORCE_PATH_STYLE", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
  if (required.some((name) => !process.env[name])) {
    throw new Error("Object storage is not configured.");
  }
  if (!["true", "false"].includes(process.env.S3_FORCE_PATH_STYLE!)) {
    throw new Error("Invalid storage configuration.");
  }
  client ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    maxAttempts: 2,
  });
  return { client, bucket: process.env.S3_BUCKET! };
}

export function assertStorageConfigured() { storage(); }

export async function putMediaObject(key: string, data: Buffer) {
  const { client, bucket } = storage();
  await client.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: data, ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
  }), { abortSignal: AbortSignal.timeout(60_000) });
}

export async function deleteMediaObject(key: string) {
  const { client, bucket } = storage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
    abortSignal: AbortSignal.timeout(15_000),
  });
}

export async function getMediaObject(key: string) {
  const { client, bucket } = storage();
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), {
    abortSignal: AbortSignal.timeout(30_000),
  });
}
