"use strict";

const Ajv2020 = require("ajv/dist/2020").default;
const { validateScene } = require("../src/runtime/mascot-motion.js");
const { parseOptions, readScene } = require("./cli-utils.js");
const { resolveSceneAssets } = require("./scene-assets.js");
const sceneSchema = require("../schema/scene.schema.json");
const ajv = new Ajv2020({ allErrors: true });
const validateSchema = ajv.compile(sceneSchema);

function main() {
  const options = parseOptions(process.argv.slice(2), ["scene"]);
  if (options.help) {
    console.log("Usage: npm run validate-scene -- --scene path/to/scene.json");
    return;
  }
  if (!options.scene) throw new Error("missing required --scene path");

  const { scene: rawScene, scenePath } = readScene(options.scene);
  const scene = rawScene.version === undefined ? { ...rawScene, version: 1 } : rawScene;
  if (!validateSchema(scene)) {
    const details = validateSchema.errors.map((error) =>
      `${error.instancePath || "/"} ${error.message}`,
    ).join("\n");
    throw new Error(`scene does not match schema/scene.schema.json:\n${details}`);
  }
  const validatedScene = validateScene(scene);
  const { assets } = resolveSceneAssets(validatedScene, scenePath);
  const remoteAssets = assets.filter((asset) => asset.remote);
  console.log(
    `Valid scene: ${validatedScene.layers.length} layers, ${Object.keys(validatedScene.animations).length} animations.`,
  );
  for (const asset of assets) {
    if (asset.remote) {
      console.warn(`Remote image not checked locally: ${asset.id} (${asset.src})`);
    } else {
      console.log(`${asset.id}: ${asset.width}×${asset.height} (${asset.path || "data URI"})`);
    }
  }
  if (remoteAssets.length) {
    console.log(`${remoteAssets.length} remote asset(s) were not checked for local existence or dimensions.`);
  }
}

try {
  main();
} catch (error) {
  console.error(`validate-scene: ${error.message}`);
  process.exitCode = 1;
}
