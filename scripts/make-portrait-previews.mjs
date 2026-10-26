import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "public", "frames-portrait");
const OUT = path.join(ROOT, "public", "previews-portrait");
const META = path.join(ROOT, "src", "data", "previews-portrait.json");
await fs.mkdir(OUT, { recursive: true });
await fs.mkdir(path.dirname(META), { recursive: true });

const files = (await fs.readdir(SRC)).filter((file) => /^f_\d{4}\.webp$/.test(file)).sort();
const firstMeta = await sharp(path.join(SRC, files[0])).metadata();
const COLS = 8;
const ROWS = 8;
const PER = COLS * ROWS;
const W = 160;
const H = Math.round((W * firstMeta.height) / firstMeta.width);
const sheets = [];

for (let start = 0; start < files.length; start += PER) {
  const slice = files.slice(start, start + PER);
  const composites = [];
  for (let index = 0; index < slice.length; index++) {
    const buffer = await sharp(path.join(SRC, slice[index]))
      .resize(W, H, { fit: "cover" })
      .webp({ quality: 70 })
      .toBuffer();
    composites.push({
      input: buffer,
      left: (index % COLS) * W,
      top: Math.floor(index / COLS) * H,
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
    .webp({ quality: 74, effort: 4 })
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
console.log(`wrote ${sheets.length} portrait preview sheets for ${files.length} frames (${W}x${H})`);
