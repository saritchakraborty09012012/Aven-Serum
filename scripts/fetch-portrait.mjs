import fs from "node:fs/promises";
import path from "node:path";

const BASE = "https://ascentastudio.com/ambar/";
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "frames-portrait");
const CHUNKS = 66;
await fs.mkdir(OUT, { recursive: true });

async function getChunk(chunk, tries = 4) {
  const url = `${BASE}packs/frames-pm2/c_${String(chunk).padStart(4, "0")}.bin?v=2`;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === tries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

const queue = Array.from({ length: CHUNKS }, (_, index) => index);
let written = 0;
let done = 0;

async function worker() {
  while (queue.length) {
    const chunk = queue.shift();
    const buffer = await getChunk(chunk);
    if (buffer.readUInt32LE(0) !== 0x50424d41) throw new Error(`bad magic in chunk ${chunk}`);
    const count = buffer.readUInt32LE(4);
    let offset = 8 + count * 8;
    for (let entry = 0; entry < count; entry++) {
      const frame = buffer.readUInt32LE(8 + entry * 8);
      const length = buffer.readUInt32LE(12 + entry * 8);
      const target = path.join(OUT, `f_${String(frame + 1).padStart(4, "0")}.webp`);
      await fs.writeFile(target, buffer.subarray(offset, offset + length));
      offset += length;
      written++;
    }
    done++;
    process.stdout.write(`\rchunks ${done}/${CHUNKS} frames ${written}`);
  }
}

await Promise.all(Array.from({ length: 6 }, () => worker()));
process.stdout.write("\n");
console.log(`downloaded ${written} portrait frames to ${OUT}`);
