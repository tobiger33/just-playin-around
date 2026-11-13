"use strict";

const fs = require("node:fs");
const { chromium } = require("playwright");

const INSTALL_MESSAGE = "Chromium fehlt: `npx playwright install chromium`";

function getChromiumStatus() {
  const executablePath = chromium.executablePath();
  return {
    executablePath,
    installed: fs.existsSync(executablePath),
  };
}

function requireChromium() {
  const status = getChromiumStatus();
  if (!status.installed) throw new Error(INSTALL_MESSAGE);
  return status;
}

module.exports = { getChromiumStatus, INSTALL_MESSAGE, requireChromium };
