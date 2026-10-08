
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const required = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];

const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error("Missing environment variables:", missing.join(", "));
  process.exit(1);
}

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const bucket = process.env.S3_BUCKET;
const key = `stockmora/connection-check/${randomUUID()}.txt`;
const content = "Stockmora Garage connection test";

let uploaded = false;

try {
  console.log("Testing Garage storage...");

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: "text/plain",
    })
  );

  uploaded = true;
  console.log("UPLOAD: SUCCESS");

  const object = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const downloaded = await object.Body.transformToString();

  if (downloaded !== content) {
    throw new Error("Downloaded content does not match");
  }

  console.log("READ: SUCCESS");
} catch (error) {
  console.error("STORAGE TEST FAILED:", error.message);
  process.exitCode = 1;
} finally {
  if (uploaded) {
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
      console.log("CLEANUP: SUCCESS");
    } catch (error) {
      console.error("CLEANUP FAILED:", error.message);
      process.exitCode = 1;
    }
  }

  client.destroy();
}
