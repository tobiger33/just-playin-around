"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { validateScene } = require("../src/runtime/mascot-motion.js");
const { requireChromium } = require("./browser-availability.js");
const { parseOptions, readScene } = require("./cli-utils.js");
const { resolveSceneAssets } = require("./scene-assets.js");

const DEFAULT_PROGRESS = [0, 0.25, 0.5, 0.75, 1];

function parseProgressList(value) {
  const progress = value.split(",").map((part) => Number(part.trim()));
  if (!progress.length || progress.some((part) => !Number.isFinite(part) || part < 0 || part > 1)) {
    throw new Error("--at values must be comma-separated numbers between 0 and 1");
  }
  if (new Set(progress).size !== progress.length) throw new Error("--at values must be unique");
  return progress;
}

function makeContactSheet(progress, framePaths, scene, outputPath) {
  const columns = Math.min(3, progress.length);
  const cellWidth = Math.min(scene.width, 360);
  const imageHeight = Math.round(cellWidth * scene.height / scene.width);
  const labelHeight = 28;
  const rows = Math.ceil(progress.length / columns);
  const width = columns * cellWidth;
  const height = rows * (imageHeight + labelHeight);
  const cells = progress.map((at, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * cellWidth;
    const y = row * (imageHeight + labelHeight);
    const image = fs.readFileSync(framePaths[index]).toString("base64");
    return (
      `<rect x="${x}" y="${y}" width="${cellWidth}" height="${imageHeight + labelHeight}" fill="#15161e"/>` +
      `<text x="${x + 8}" y="${y + 19}" fill="#fff" font-family="monospace" font-size="13">at ${at}</text>` +
      `<image x="${x}" y="${y + labelHeight}" width="${cellWidth}" height="${imageHeight}" ` +
      `preserveAspectRatio="none" href="data:image/png;base64,${image}"/>`
    );
  }).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `${cells}</svg>`;
  fs.writeFileSync(outputPath, svg);
  return { width, height };
}

async function main() {
  const options = parseOptions(process.argv.slice(2), ["scene", "anim", "at", "out", "debug"], ["debug"]);
  if (options.help) {
    console.log("Usage: npm run frames -- --scene path/to/scene.json --anim idle --at 0,0.25,0.5,0.75,1 [--out frames] [--debug]");
    return;
  }
  if (!options.scene || !options.anim) throw new Error("required options: --scene and --anim");
  requireChromium();

  const { scene: rawScene, scenePath } = readScene(options.scene);
  const validatedScene = validateScene({
    ...rawScene,
    debug: options.debug === true || rawScene.debug === true,
  });
  const animation = validatedScene.animations[options.anim];
  if (!animation) throw new Error(`unknown animation "${options.anim}"`);
  const progress = options.at ? parseProgressList(options.at) : DEFAULT_PROGRESS;
  const { scene } = resolveSceneAssets(validatedScene, scenePath);
  const outputDirectory = path.resolve(options.out || path.join(path.dirname(scenePath), "frames", options.anim));
  fs.mkdirSync(outputDirectory, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: {
        width: Math.min(Math.max(320, Math.ceil(scene.width)), 1920),
        height: Math.min(Math.max(320, Math.ceil(scene.height)), 1200),
      },
    });
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#15161e}#stage{position:relative;width:${scene.width}px;height:${scene.height}px;overflow:visible}</style><div id="stage"></div>`,
    );
    await page.addScriptTag({ path: path.resolve(__dirname, "../src/runtime/mascot-motion.js") });
    await page.evaluate(
      ({ config, animationName }) => {
        window.__mascotMotion = MascotMotion.mount(document.querySelector("#stage"), config);
        window.__mascotMotion.play(animationName);
        window.__mascotMotion.pause();
      },
      { config: scene, animationName: options.anim },
    );
    await page.evaluate(async () => {
      await Promise.all(Array.from(document.querySelectorAll("#stage img"), (image) => image.decode()));
    });

    const framePaths = [];
    for (let index = 0; index < progress.length; index += 1) {
      const at = progress[index];
      await page.evaluate((value) => window.__mascotMotion.seek(value), at);
      const framePath = path.join(outputDirectory, `frame-${String(index + 1).padStart(2, "0")}-at-${at}.png`);
      await page.locator("#stage").screenshot({ path: framePath });
      framePaths.push(framePath);
    }

    const contactSheetPath = path.join(outputDirectory, "contact-sheet.svg");
    const dimensions = makeContactSheet(progress, framePaths, scene, contactSheetPath);
    const contactSheetPngPath = path.join(outputDirectory, "contact-sheet.png");
    const contactPage = await browser.newPage({
      viewport: { width: dimensions.width, height: dimensions.height },
    });
    await contactPage.setContent('<!doctype html><meta charset="utf-8"><img id="contact-sheet" style="display:block">');
    await contactPage.locator("#contact-sheet").evaluate((image, dataUrl) => {
      image.src = dataUrl;
      return image.decode();
    }, `data:image/svg+xml;base64,${fs.readFileSync(contactSheetPath).toString("base64")}`);
    await contactPage.locator("#contact-sheet").screenshot({ path: contactSheetPngPath });
    await contactPage.close();
    console.log(`Rendered ${framePaths.length} frames to ${outputDirectory}`);
    console.log(`Contact sheets: ${contactSheetPngPath} (PNG), ${contactSheetPath} (SVG)`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`render-frames: ${error.message}`);
  process.exitCode = 1;
});
