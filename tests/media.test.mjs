import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const batchId = "7d01f60e-02c6-492d-93a0-b4284479bf30";
const otherBatchId = "7d01f60e-02c6-492d-93a0-b4284479bf31";

// Compile the real route/helpers with the project's existing TypeScript package.
// Only external services are substituted: no auth server, DB or Garage writes.
function loadSource(relative, substitutions = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiledModule = { exports: {} };
    cache.set(filename, compiledModule);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const requireLocal = (name) => {
      if (Object.hasOwn(substitutions, name)) return substitutions[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/")) return load(path.join(root, "src", `${name.slice(2)}.ts`));
      if (name.startsWith(".")) return load(path.resolve(path.dirname(filename), `${name}.ts`));
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", source)(requireLocal, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  return load(path.join(root, relative));
}

const { optimizeImage, validateOriginalFilename } = loadSource("src/lib/media/image.ts");
const { mediaUrl, MAX_IMAGE_BYTES } = loadSource("src/lib/media/shared.ts");

function request(url, method = "POST", body = "", extraHeaders = {}) {
  const origin = new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000").origin;
  return new Request(`${origin}${url}`, {
    method, headers: { origin, ...extraHeaders },
    ...(method === "POST" ? { body } : {}),
  });
}

test("valid images become WebP without upscaling or supplier metadata", async () => {
  for (const format of ["jpeg", "png", "webp"]) {
    const filename = `IMG_8472.${format === "jpeg" ? "jpg" : format}`;
    const input = await sharp({ create: { width: 80, height: 40, channels: 3, background: "red" } })[format]().withMetadata().toBuffer();
    const result = await optimizeImage(input, filename, `image/${format}`);
    const output = await sharp(result.data).metadata();
    assert.equal(output.format, "webp");
    assert.equal(output.width, 80);
    assert.equal(output.height, 40);
    assert.equal(output.exif, undefined);
    assert.equal(result.width, 80);
  }
});

test("large images keep their aspect ratio within 2400 pixels", async () => {
  const input = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "blue" } }).png().toBuffer();
  const result = await optimizeImage(input, "large.png", "image/png");
  assert.equal(result.width, 2400);
  assert.equal(result.height, 1200);
});

test("reject spoofed files, mismatched types, unsupported images and oversized dimensions", async () => {
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "blue" } }).png().toBuffer();
  await assert.rejects(optimizeImage(Buffer.from("not an image"), "image.jpg", "image/jpeg"));
  await assert.rejects(optimizeImage(png, "image.jpg", "image/jpeg"));
  await assert.rejects(optimizeImage(png, "image.png", "image/webp"));
  await assert.rejects(optimizeImage(png.subarray(0, 32), "image.png", "image/png"));
  await assert.rejects(optimizeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image.png", "image/png"));
  await assert.rejects(optimizeImage(Buffer.alloc(MAX_IMAGE_BYTES + 1), "big.png", "image/png"));
  const bomb = await sharp({ create: { width: 6000, height: 5000, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(optimizeImage(bomb, "bomb.png", "image/png"), /25 megapixels/);
  const frames = await sharp([png, await sharp(png).negate().png().toBuffer()], { join: { animated: true } })
    .webp({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(frames).metadata()).pages, 2);
  await assert.rejects(optimizeImage(frames, "animation.webp", "image/webp"));
  // An APNG animation control chunk must be rejected before libvips can flatten
  // it into a still image. Its length is enough to reach our bounded parser.
  const animationControl = Buffer.alloc(20);
  animationControl.writeUInt32BE(8, 0);
  animationControl.write("acTL", 4);
  const apng = Buffer.concat([png.subarray(0, 33), animationControl, png.subarray(33)]);
  await assert.rejects(optimizeImage(apng, "animation.png", "image/png"), /Animated PNG/);
});

test("original filenames remain exact and cannot become storage paths", () => {
  assert.equal(validateOriginalFilename("IMG_8472.JPG"), "IMG_8472.JPG");
  assert.equal(validateOriginalFilename("Tasse-é.png"), "Tasse-é.png");
  for (const name of ["../photo.jpg", "folder\\photo.png", "bad\0.png", "bad\n.png", " photo.jpg", "file.svg", `${"a".repeat(256)}.jpg`]) {
    assert.throws(() => validateOriginalFilename(name));
  }
  assert.equal(mediaUrl(batchId, "Stainless Steel Travel Mug.jpg"), `/media/${batchId}/stainless-steel-travel-mug.webp`);
});

test("all administrative routes refuse anonymous and buyer requests before accessing services", async () => {
  for (const role of [null, "user"]) {
    const services = {
      "@/lib/auth": { auth: { api: { getSession: async () => role ? { user: { role } } : null } } },
      "@/db": { db: new Proxy({}, { get() { assert.fail("Unauthorized request reached database"); } }) },
      "@/lib/media/storage": new Proxy({}, { get() { assert.fail("Unauthorized request reached storage"); } }),
    };
    for (const [route, methods] of [["batches", ["GET", "POST"]], ["assets", ["GET"]], ["upload", ["POST"]]]) {
      const endpoint = loadSource(`src/app/api/admin/media/${route}/route.ts`, services);
      for (const method of methods) {
        const response = await endpoint[method](request(`/api/admin/media/${route}`, method));
        assert.equal(response.status, role ? 403 : 401);
      }
    }
  }
});

test("admin mutations reject cross-origin requests", async () => {
  const endpoint = loadSource("src/app/api/admin/media/batches/route.ts", {
    "@/lib/auth": { auth: { api: { getSession: async () => assert.fail("Cross-origin request reached session") } } },
    "@/db": { db: {} },
  });
  const response = await endpoint.POST(request("/api/admin/media/batches", "POST", "{}", { origin: "https://untrusted.invalid" }));
  assert.equal(response.status, 403);
});

test("missing media tables produce a clear migration message without database details", async () => {
  const { mediaErrorResponse } = loadSource("src/lib/media/admin.ts", { "@/lib/auth": { auth: {} } });
  const error = new Error("Query parameters and sensitive database details");
  error.cause = Object.assign(new Error('relation "import_batches" does not exist'), { code: "42P01" });
  const response = mediaErrorResponse(error);
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.match(body, /database tables are missing/);
  assert.ok(!body.includes("sensitive database"));
  assert.ok(!body.includes("Query parameters"));
  const cyclic = new Error("Unknown error");
  cyclic.cause = cyclic;
  assert.equal(mediaErrorResponse(cyclic).status, 503);
});

test("bounded reads enforce actual bytes, even with a missing or misleading Content-Length", async () => {
  const { readBoundedBody } = loadSource("src/lib/media/upload.ts", { "@/lib/auth": { auth: {} } });
  for (const headers of [{}, { "content-length": "1" }]) {
    await assert.rejects(readBoundedBody(request("/upload", "POST", "123456", headers), 5), (error) => error.status === 413);
  }
  assert.equal((await readBoundedBody(request("/upload", "POST", "12345"), 5)).toString(), "12345");
  await assert.rejects(readBoundedBody(request("/upload", "POST", ""), 5), (error) => error.status === 400);
});

test("server upload slots reject excess requests and recover after release", () => {
  const { reserveUpload } = loadSource("src/lib/media/upload.ts", { "@/lib/auth": { auth: {} } });
  const first = reserveUpload();
  const second = reserveUpload();
  try { assert.throws(reserveUpload, (error) => error.status === 429); }
  finally { first(); second(); }
  const next = reserveUpload();
  next();
});

test("uploads persist exact filenames, keep identical names in different batches separate, and clean up failed inserts", async () => {
  const uploaded = new Map();
  const saved = [];
  let selects = 0;
  let failInsert = false;
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => ++selects % 2 ? [{ id: batchId }] : [] }) }) }),
    insert: () => ({ values: async (value) => {
      if (failInsert) throw Object.assign(new Error("Sensitive database details"), { code: "23505" });
      saved.push(value);
    } }),
  };
  const endpoint = loadSource("src/app/api/admin/media/upload/route.ts", {
    "@/lib/auth": { auth: { api: { getSession: async () => ({ user: { role: "admin" } }) } } },
    "@/db": { db },
    "@/lib/media/storage": {
      assertStorageConfigured() {},
      putMediaObject: async (key, body) => uploaded.set(key, body),
      deleteMediaObject: async (key) => uploaded.delete(key),
    },
  });
  const png = await sharp({ create: { width: 20, height: 10, channels: 3, background: "white" } }).png().toBuffer();
  for (const batch of [batchId, otherBatchId]) {
    const response = await endpoint.POST(request(`/api/admin/media/upload?batchId=${batch}`, "POST", png, {
      "content-type": "image/png", "x-file-name": encodeURIComponent("IMG_8472.png"),
    }));
    assert.equal(response.status, 201);
    assert.equal((await response.json()).asset.originalFilename, "IMG_8472.png");
  }
  assert.equal(saved.length, 2);
  assert.notEqual(saved[0].objectKey, saved[1].objectKey);
  assert.equal(saved[0].originalFilename, saved[1].originalFilename);
  assert.equal(saved[0].mimeType, "image/webp");
  assert.ok(saved[0].objectKey.startsWith(`media/${batchId}/`));
  assert.ok(!saved[0].objectKey.includes("IMG_8472"));
  failInsert = true;
  const failed = await endpoint.POST(request(`/api/admin/media/upload?batchId=${batchId}`, "POST", png, {
    "content-type": "image/png", "x-file-name": "IMG_8472.png",
  }));
  assert.equal(failed.status, 409);
  assert.equal(uploaded.size, 2);
  assert.ok(!(await failed.text()).includes("Sensitive database"));
});

test("public delivery accepts registered IDs, uses the database key, and returns cache validators", async () => {
  const assetId = "75424dfc-4bdb-4d50-a4fc-f399effde90a";
  let reads = 0;
  let lookups = 0;
  const endpoint = loadSource("src/app/media/[id]/[filename]/route.ts", {
    "@/db": { db: { select: () => {
      lookups++;
      return { from: () => ({ where: () => ({ limit: async () => [{ id: assetId, objectKey: "known/database/key.webp", sizeBytes: 3 }] }) }) };
    } } },
    "@/lib/media/storage": { getMediaObject: async (key) => {
      reads++;
      assert.equal(key, "known/database/key.webp");
      return { Body: { transformToWebStream: () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); controller.close(); } }) } };
    } },
  });
  const context = { params: Promise.resolve({ id: assetId, filename: "travel-mug-1.webp" }) };
  const response = await endpoint.GET(request(`/media/${assetId}/travel-mug-1.webp`, "GET"), context);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await response.arrayBuffer()).byteLength, 3);
  assert.equal(reads, 1);
  const cached = await endpoint.GET(request("/media/test", "GET", "", { "if-none-match": `"${assetId}"` }), context);
  assert.equal(cached.status, 304);
  const head = await endpoint.HEAD(request("/media/test", "HEAD"), context);
  assert.equal(head.status, 200);
  assert.equal(reads, 1);
  const invalid = await endpoint.GET(request("/media/test", "GET"), { params: Promise.resolve({ id: "../../secrets", filename: "image.webp" }) });
  assert.equal(invalid.status, 404);
  assert.equal(lookups, 3);
});
