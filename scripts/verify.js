"use strict";

const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

function run(label, args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

try {
  const root = path.resolve(__dirname, "..");
  const fixture = path.join(root, "tests", "fixtures", "scene.json");
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "mascot-motion-verify-"));
  run("tests", ["--test"], root);
  run("scene validation", [path.join(root, "scripts", "validate-scene.js"), "--scene", fixture]);
  run("frame rendering", [
    path.join(root, "scripts", "render-frames.js"),
    "--scene",
    fixture,
    "--anim",
    "idle",
    "--at",
    "0,0.25,0.5,0.75,1",
    "--out",
    output,
  ]);
} catch (error) {
  console.error(`verify: ${error.message}`);
  process.exitCode = 1;
}
