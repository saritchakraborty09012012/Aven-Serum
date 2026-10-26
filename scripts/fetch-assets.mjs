import fs from "node:fs/promises";
import path from "node:path";

const BASE = "https://ascentastudio.com/ambar/";
const ROOT = path.resolve(import.meta.dirname, "..");
const FRAMES = path.join(ROOT, "public", "frames");
const FONTS = path.join(ROOT, "public", "fonts");
const CATALOG = path.join(ROOT, "public", "catalog");

await Promise.all([FRAMES, FONTS, CATALOG].map((d) => fs.mkdir(d, { recursive: true })));

async function fetchWithRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
}

const totalChunks = 108;
let done = 0;
const queue = Array.from({ length: totalChunks }, (_, i) => i);
let nextFrame = 0;

async function worker(id) {
  while (queue.length) {
    const chunk = queue.shift();
    const buf = await fetchWithRetry(`${BASE}packs/frames/c_${String(chunk).padStart(4, "0")}.bin?v=1`);
    if (buf.readUInt32LE(0) !== 0x50424d41) throw new Error(`bad magic chunk ${chunk}`);
    const n = buf.readUInt32LE(4);
    let off = 8 + n * 8;
    for (let k = 0; k < n; k++) {
      const frame = buf.readUInt32LE(8 + k * 8);
      const len = buf.readUInt32LE(12 + k * 8);
      const dest = path.join(FRAMES, `f_${String(frame + 1).padStart(4, "0")}.webp`);
      await fs.writeFile(dest, buf.subarray(off, off + len));
      off += len;
      nextFrame++;
    }
    done++;
    process.stdout.write(`\rchunks ${done}/${totalChunks} · frames ${nextFrame}`);
  }
}

await Promise.all(Array.from({ length: 8 }, (_, i) => worker(i)));
process.stdout.write("\n");

const fonts = await Promise.all(
  Array.from({ length: 7 }, async (_, i) => {
    const buf = await fetchWithRetry(`${BASE}fonts/font-${i}.woff2`);
    await fs.writeFile(path.join(FONTS, `font-${i}.woff2`), buf);
    return buf.length;
  })
);
console.log(`fonts: ${fonts.map((n) => `${(n / 1024).toFixed(0)}k`).join(" ")}`);

const assets = [
  ["catalog/serum.webp", "serum.webp"],
  ["catalog/serum-orange.webp", "serum-orange.webp"],
  ["catalog/serum-s.webp", "serum-s.webp"],
  ["catalog/serum-orange-s.webp", "serum-orange-s.webp"],
  ["logo.png", "../logo.png"],
];
for (const [src, dest] of assets) {
  const buf = await fetchWithRetry(BASE + src);
  const out = path.resolve(CATALOG, dest);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, buf);
}

const css = (await fetchWithRetry(`${BASE}fonts/fonts.css`)).toString("utf8");
await fs.writeFile(path.join(FONTS, "fonts.css"), css);
const mapJs = (await fetchWithRetry(`${BASE}framemap.js`)).toString("utf8");
const match = /window\.__FMAP=(\{.*\});?/s.exec(mapJs);
if (!match) throw new Error("frame map not found");
const map = JSON.parse(match[1]);
await fs.mkdir(path.join(ROOT, "src", "data"), { recursive: true });
await fs.writeFile(
  path.join(ROOT, "src", "data", "framemap.json"),
  JSON.stringify({ desktop: map.desktop, portrait: map.portrait })
);
console.log(`framemap: desktop ${map.desktop_n}, portrait ${map.portrait_n}`);
