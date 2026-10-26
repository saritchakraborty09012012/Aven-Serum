import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "public", "frames");
const OUT = path.join(ROOT, "public", "previews");
const META = path.join(ROOT, "src", "data", "previews.json");
await fs.mkdir(OUT, { recursive: true });
await fs.mkdir(path.dirname(META), { recursive: true });

const files = (await fs.readdir(SRC)).filter((f) => /^f_\d{4}\.webp$/.test(f)).sort();
const firstMeta = await sharp(path.join(SRC, files[0])).metadata();
const COLS = 6;
const ROWS = 6;
const PER = COLS * ROWS;
const W = 640;
const H = Math.round((W * firstMeta.height) / firstMeta.width);
const sheets = [];

for (let start = 0; start < files.length; start += PER) {
  const slice = files.slice(start, start + PER);
  const composites = [];
  for (let i = 0; i < slice.length; i++) {
    const buf = await sharp(path.join(SRC, slice[i]))
      .resize(W, H, { fit: "cover" })
      .webp({ quality: 78 })
      .toBuffer();
    composites.push({
      input: buf,
      left: (i % COLS) * W,
      top: Math.floor(i / COLS) * H,
    });
  }
  const name = `sheet_${String(sheets.length).padStart(2, "0")}.webp`;
  await sharp({
    create: {
      width: COLS * W,
      height: ROWS * H,
      channels: 3,
      background: "#120000",
    },
  })
    .composite(composites)
    .webp({ quality: 80, effort: 4 })
    .toFile(path.join(OUT, name));
  sheets.push({
    file: name,
    start,
    count: slice.length,
    cols: COLS,
    rows: ROWS,
    width: W,
    height: H,
  });
  process.stdout.write(`\rsheets ${sheets.length} - frames ${Math.min(start + PER, files.length)}/${files.length}`);
}

await fs.writeFile(META, JSON.stringify({ sheets, total: files.length }, null, 2));
process.stdout.write("\n");
console.log(`wrote ${sheets.length} preview sheets for ${files.length} frames (${W}x${H})`);
