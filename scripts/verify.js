"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { getChromiumStatus, INSTALL_MESSAGE } = require("./browser-availability.js");

function run(label, args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

try {
  const root = path.resolve(__dirname, "..");
  const fixture = path.join(root, "tests", "fixtures", "scene.json");
  const skipBrowser = process.env.SKIP_BROWSER === "1";
  const chromiumStatus = getChromiumStatus();
  if (!chromiumStatus.installed && !skipBrowser) {
    throw new Error(`${INSTALL_MESSAGE} (set SKIP_BROWSER=1 to skip browser checks).`);
  }
  run("tests", ["--test"], root);
  run("scene validation", [path.join(root, "scripts", "validate-scene.js"), "--scene", fixture]);
  if (skipBrowser) {
    console.log("Browser checks skipped because SKIP_BROWSER=1.");
  } else {
    run("motion checks", [path.join(root, "scripts", "check-motion.js"), "--scene", fixture]);
    const output = path.join(root, "frames", "verify");
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
  }
} catch (error) {
  console.error(`verify: ${error.message}`);
  process.exitCode = 1;
}
