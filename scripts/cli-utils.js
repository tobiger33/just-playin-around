"use strict";

function parseOptions(argv, allowed, booleanOptions = []) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--help" || key === "-h") {
      options.help = true;
      continue;
    }
    if (!key.startsWith("--") || !allowed.includes(key.slice(2))) {
      throw new Error(`unknown option "${key}"`);
    }
    if (booleanOptions.includes(key.slice(2))) {
      options[key.slice(2)] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`option "${key}" needs a value`);
    options[key.slice(2)] = value;
    index += 1;
  }
  return options;
}

function readScene(scenePath) {
  const fs = require("node:fs");
  const path = require("node:path");
  const resolvedPath = path.resolve(scenePath);
  let scene;
  try {
    scene = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  } catch (error) {
    throw new Error(`could not read scene "${resolvedPath}": ${error.message}`);
  }
  return { scene, scenePath: resolvedPath };
}

module.exports = { parseOptions, readScene };
