import { createServer } from "vite";
import { chromium } from "playwright-core";

const ORIGIN = "http://127.0.0.1:5199";
const server = await createServer({
  server: { port: 5199, strictPort: true, host: "127.0.0.1" },
  logLevel: "error",
});
await server.listen();

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

try {
  // 1. Sample the original logo: background alpha + text colour.
  const probe = await browser.newPage();
  await probe.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded" });
  const sample = await probe.evaluate(async (origin) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = `${origin}/logo.png`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let darkest = [255, 255, 255];
    let cornerAlpha = data[3];
    for (let index = 0; index < data.length; index += 4) {
      const sum = data[index] + data[index + 1] + data[index + 2];
      const dark = darkest[0] + darkest[1] + darkest[2];
      if (data[index + 3] > 128 && sum < dark) darkest = [data[index], data[index + 1], data[index + 2]];
    }
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      cornerAlpha,
      darkest: `rgb(${darkest[0]}, ${darkest[1]}, ${darkest[2]})`,
    };
  }, ORIGIN);
  await probe.close();
  console.log("original", JSON.stringify(sample));

  // 2. Render AVEN in the same face, weight and tracking.
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded" });
  await page.setContent(
    `<!doctype html><html><head>
      <link rel="stylesheet" href="${ORIGIN}/fonts/fonts.css">
      <style>
        html,body{margin:0;padding:0;background:transparent}
        #mark{
          font-family:"Bricolage Grotesque","Helvetica Neue",Arial,sans-serif;
          font-weight:700;
          font-size:132px;
          line-height:1;
          letter-spacing:.3em;
          text-indent:.3em;
          color:${sample.darkest};
          display:inline-block;
          padding:9px 6px 9px 0;
          white-space:nowrap;
        }
      </style></head><body><div id="mark">AVEN</div></body></html>`,
    { waitUntil: "networkidle" }
  );
  await page.evaluate(() => document.fonts.ready);
  const box = await page.evaluate(() => {
    const rect = document.querySelector("#mark").getBoundingClientRect();
    return { w: Math.ceil(rect.width), h: Math.ceil(rect.height) };
  });
  await page.locator("#mark").screenshot({ path: "public/logo.png", omitBackground: true });
  console.log("wrote public/logo.png", JSON.stringify(box));
} finally {
  await browser.close();
  await server.close();
}
