import sharp from "sharp";
import { MAX_IMAGE_BYTES } from "./shared";

// These helpers have no credentials or database dependencies, so their actual
// decoding and resource limits can be verified without a running Garage service.
export const MAX_INPUT_PIXELS = 25_000_000;

export function validateOriginalFilename(filename: string) {
  if (!filename || filename.length > 255 || filename !== filename.trim() ||
      /[\\/\x00-\x1f\x7f]/.test(filename) || !/\.(jpe?g|png|webp)$/i.test(filename)) {
    throw new Error("Use a JPG, PNG or WebP filename without paths (maximum 255 characters).");
  }
  // Do not normalize case or Unicode: CSV matching will use this exact value.
  return filename;
}

export async function optimizeImage(input: Buffer, filename: string, declaredType: string) {
  validateOriginalFilename(filename);
  if (!input.length || input.length > MAX_IMAGE_BYTES) {
    throw new Error("Each image must be between 1 byte and 10 MiB.");
  }
  const expected = /\.jpe?g$/i.test(filename) ? "jpeg" : /\.png$/i.test(filename) ? "png" : "webp";
  const signatureMatches = expected === "jpeg"
    ? input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff
    : expected === "png"
      ? input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : input.length >= 12 && input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP";
  if (!signatureMatches) throw new Error("The file content does not match its JPG, PNG or WebP filename.");
  // libvips can decode only the first frame of APNG, so reject its animation
  // control chunk explicitly rather than accidentally accepting an animation.
  if (expected === "png") {
    for (let offset = 8; offset + 12 <= input.length;) {
      const size = input.readUInt32BE(offset);
      const type = input.toString("ascii", offset + 4, offset + 8);
      if (type === "acTL") throw new Error("Animated PNG images are not supported.");
      if (type === "IEND") break;
      offset += size + 12;
    }
  }
  const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "warning" });
  try {
    const metadata = await image.metadata();
    if (metadata.format !== expected || declaredType !== `image/${expected}` ||
        (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height ||
        metadata.width > 16384 || metadata.height > 16384 ||
        metadata.width * metadata.height > MAX_INPUT_PIXELS) {
      throw new Error("Invalid format or dimensions.");
    }
    const result = await image.rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 }).timeout({ seconds: 15 })
      .toBuffer({ resolveWithObject: true });
    if (result.data.length > MAX_IMAGE_BYTES) throw new Error("Output too large.");
    return { data: result.data, width: result.info.width, height: result.info.height };
  } catch {
    throw new Error("The file must be a valid, non-animated JPG, PNG or WebP image of at most 25 megapixels.");
  } finally {
    image.destroy();
  }
}
