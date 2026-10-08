import "server-only";

import { MAX_IMAGE_BYTES, UPLOAD_CONCURRENCY } from "./shared";
import { MediaRequestError } from "./admin";

// Shared across concurrent requests in one Node process. Refuse excess work
// before reading its body instead of building an unbounded processing queue.
const uploadGlobal = globalThis as unknown as { mediaUploads?: number };

export function reserveUpload() {
  if ((uploadGlobal.mediaUploads ?? 0) >= UPLOAD_CONCURRENCY) {
    throw new MediaRequestError("Upload capacity is busy. Retry this file shortly.", 429);
  }
  uploadGlobal.mediaUploads = (uploadGlobal.mediaUploads ?? 0) + 1;
  let released = false;
  return () => {
    if (!released) uploadGlobal.mediaUploads = Math.max(0, (uploadGlobal.mediaUploads ?? 1) - 1);
    released = true;
  };
}

export async function readBoundedBody(request: Request, maximumBytes = MAX_IMAGE_BYTES) {
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length < 0 || length > maximumBytes) {
    throw new MediaRequestError("Request body is too large.", 413);
  }
  if (!request.body) throw new MediaRequestError("An image is required.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 30_000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (timedOut) throw new MediaRequestError("Upload timed out. Retry this file.", 408);
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new MediaRequestError("Request body is too large.", 413);
      }
      chunks.push(value);
    }
    if (!size) throw new MediaRequestError("An empty file cannot be uploaded.", 400);
    return Buffer.concat(chunks, size);
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
}
