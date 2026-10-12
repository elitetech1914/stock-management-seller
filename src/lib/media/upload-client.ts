import { MAX_IMAGE_BYTES, type MediaAssetView } from "./shared";

export function validateUploadFile(file: File) {
  if (!/\.(jpe?g|png|webp)$/i.test(file.name) || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Choose JPG, PNG or WebP images.";
  if (!file.size || file.size > MAX_IMAGE_BYTES) return "Each image must be between 1 byte and 10 MiB.";
}

export function sendMediaFile(batchId: string, file: File, progress: (percent: number, processing: boolean) => void) {
  return new Promise<MediaAssetView>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/media/upload?batchId=${encodeURIComponent(batchId)}`);
    xhr.timeout = 150_000;
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) progress(Math.min(99, Math.round(event.loaded / event.total * 100)), event.loaded === event.total);
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data.asset);
        else reject(new Error(data.error || "Upload failed. Please retry."));
      } catch { reject(new Error("Unexpected upload response. Refresh the library before retrying.")); }
    };
    xhr.onerror = () => reject(new Error("Network error. Refresh the library before retrying."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Refresh the library before retrying."));
    xhr.send(file);
  });
}
