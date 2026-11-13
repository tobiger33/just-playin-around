"use strict";

const path = require("node:path");
const { chromium } = require("playwright");
const { validateScene } = require("../src/runtime/mascot-motion.js");
const { requireChromium } = require("./browser-availability.js");
const { parseOptions, readScene } = require("./cli-utils.js");
const { resolveSceneAssets } = require("./scene-assets.js");

function sampleProgress(animation) {
  const values = new Set([0, 1]);
  for (const frames of Object.values(animation.tracks)) {
    for (let index = 0; index < frames.length; index += 1) {
      values.add(frames[index].at);
      if (index === 0) continue;
      const start = frames[index - 1].at;
      const end = frames[index].at;
      for (let step = 1; step < 10; step += 1) {
        values.add(start + ((end - start) * step) / 10);
      }
    }
  }
  return [...values].sort((left, right) => left - right);
}

function analyzeMotion(scene, animationName, samples) {
  const animation = scene.animations[animationName];
  const issues = [];
  const trackedLayers = Object.keys(animation.tracks);

  for (const layer of scene.layers) {
    if (!animation.tracks[layer.id]) {
      issues.push({
        severity: "warning",
        message: `${animationName}: layer "${layer.id}" has no track across progress 0.000-1.000.`,
      });
    }
  }

  let anyLayerMoves = false;
  for (const layerId of trackedLayers) {
    const states = samples.map((sample) => sample.layers[layerId].state);
    const initial = states[0];
    const moves = states.some((state) =>
      Object.keys(initial).some((property) => Math.abs(state[property] - initial[property]) > 0.01),
    );
    if (moves) {
      anyLayerMoves = true;
    } else {
      issues.push({
        severity: "warning",
        message: `${animationName}: layer "${layerId}" has a track but no measurable movement between progress 0.000 and 1.000.`,
      });
    }
  }

  const reportedExtremes = new Set();
  for (const sample of samples) {
    for (const layerId of trackedLayers) {
      const state = sample.layers[layerId].state;
      for (const property of ["rotateX", "rotateY", "rotateZ"]) {
        const key = `${layerId}:${property}`;
        if (Math.abs(state[property]) > 180 && !reportedExtremes.has(key)) {
          reportedExtremes.add(key);
          issues.push({
            severity: "warning",
            message: `${animationName}: layer "${layerId}" at progress ${sample.at.toFixed(3)} has extreme ${property} ${state[property]}° (>180°).`,
          });
        }
      }
      for (const property of ["scaleX", "scaleY", "scaleZ"]) {
        const key = `${layerId}:${property}`;
        if (state[property] < 0.1 && !reportedExtremes.has(key)) {
          reportedExtremes.add(key);
          issues.push({
            severity: "warning",
            message: `${animationName}: layer "${layerId}" at progress ${sample.at.toFixed(3)} has extreme ${property} ${state[property]} (<0.1).`,
          });
        }
      }
    }
  }

  for (const layer of scene.layers) {
    for (const sample of samples) {
      const { left, top, right, bottom } = sample.layers[layer.id].bounds;
      if (left < -0.5 || top < -0.5 || right > scene.width + 0.5 || bottom > scene.height + 0.5) {
        issues.push({
          severity: "error",
          message: `${animationName}: layer "${layer.id}" leaves the canvas at ${sample.at.toFixed(3)}.`,
        });
        break;
      }
    }
  }

  if (!anyLayerMoves) {
    issues.push({
      severity: "error",
      message: `${animationName}: animation has no measurable movement across progress 0.000-1.000.`,
    });
  }
  return issues;
}

async function collectSamples(scene, animationName, samplesAt) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: {
        width: Math.min(Math.max(320, Math.ceil(scene.width)), 1920),
        height: Math.min(Math.max(320, Math.ceil(scene.height)), 1200),
      },
    });
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}#stage{position:relative;width:${scene.width}px;height:${scene.height}px;overflow:visible}</style><div id="stage"></div>`,
    );
    await page.addScriptTag({ path: path.resolve(__dirname, "../src/runtime/mascot-motion.js") });
    await page.evaluate(
      ({ config, name }) => {
        window.__mascotMotion = MascotMotion.mount(document.querySelector("#stage"), config);
        window.__mascotMotion.play(name);
        window.__mascotMotion.pause();
      },
      { config: scene, name: animationName },
    );
    await page.evaluate(async () => {
      await Promise.all(Array.from(document.querySelectorAll("#stage img"), (image) => image.decode()));
    });

    const collected = [];
    for (const at of samplesAt) {
      collected.push(await page.evaluate((progress) => {
        const stage = document.querySelector("#stage");
        const stageBounds = stage.getBoundingClientRect();
        window.__mascotMotion.seek(progress);
        return {
          at: progress,
          layers: Object.fromEntries(window.__mascotMotion.layerIds.map((id) => {
            const rect = stage.querySelector(`[data-mascot-layer="${CSS.escape(id)}"]`).getBoundingClientRect();
            return [
              id,
              {
                state: window.__mascotMotion.getState(id),
                bounds: {
                  left: rect.left - stageBounds.left,
                  top: rect.top - stageBounds.top,
                  right: rect.right - stageBounds.left,
                  bottom: rect.bottom - stageBounds.top,
                },
              },
            ];
          })),
        };
      }, at));
    }
    return collected;
  } finally {
    await browser.close();
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2), ["scene", "anim"]);
  if (options.help) {
    console.log("Usage: npm run check-motion -- --scene path/to/scene.json [--anim idle]");
    return;
  }
  if (!options.scene) throw new Error("missing required --scene path");

  const { scene: rawScene, scenePath } = readScene(options.scene);
  const validatedScene = validateScene(rawScene);
  const { scene } = resolveSceneAssets(validatedScene, scenePath);
  const animationNames = options.anim ? [options.anim] : Object.keys(scene.animations);
  for (const name of animationNames) {
    if (!scene.animations[name]) throw new Error(`unknown animation "${name}"`);
  }
  requireChromium();

  let errors = 0;
  let warnings = 0;
  for (const name of animationNames) {
    const samples = await collectSamples(scene, name, sampleProgress(scene.animations[name]));
    const issues = analyzeMotion(scene, name, samples);
    for (const issue of issues) {
      console[issue.severity === "error" ? "error" : "warn"](`${issue.severity}: ${issue.message}`);
      if (issue.severity === "error") errors += 1;
      else warnings += 1;
    }
    if (!issues.length) console.log(`${name}: motion checks passed.`);
  }
  console.log(`Motion check complete: ${errors} error(s), ${warnings} warning(s).`);
  if (errors) process.exitCode = 1;
}

module.exports = { analyzeMotion, sampleProgress };

if (require.main === module) {
  main().catch((error) => {
    console.error(`check-motion: ${error.message}`);
    process.exitCode = 1;
  });
}
