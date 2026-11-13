"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright");
const Ajv2020 = require("ajv/dist/2020").default;
const { validateScene } = require("../src/runtime/mascot-motion.js");
const sceneSchema = require("../schema/scene.schema.json");
const { getChromiumStatus, INSTALL_MESSAGE } = require("../scripts/browser-availability.js");
const { analyzeMotion, sampleProgress } = require("../scripts/check-motion.js");
const chromiumStatus = getChromiumStatus();
const validateSchema = new Ajv2020().compile(sceneSchema);

function validScene(overrides = {}) {
  return {
    version: 1,
    width: 100,
    height: 100,
    layers: [{ id: "body", src: "data:image/svg+xml,<svg/>" }],
    animations: {
      move: {
        duration: 2,
        loop: false,
        tracks: {
          body: [
            { at: 0, x: 0 },
            { at: 1, x: 100 },
          ],
        },
      },
    },
    ...overrides,
  };
}

test("scene validation rejects loops and cyclic layer hierarchies", () => {
  assert.equal(validateScene(validScene()).version, 1);
  assert.equal(validateScene(validScene({ version: undefined })).version, 1);
  assert.throws(() => validateScene(validScene({ version: 2 })), /supports version 1/);
  assert.throws(
    () => validateScene(validScene({ layers: [{ id: "body", src: "image.png", parent: "head" }, { id: "head", src: "head.png", parent: "body" }] })),
    /cycle/,
  );
  assert.throws(
    () => validateScene(validScene({
      animations: {
        move: { duration: 1, loop: true, tracks: { body: [{ at: 0, x: 0 }, { at: 1, x: 10 }] } },
      },
    })),
    /matching first and last poses/,
  );
});

test("scene schema requires version 1 and rejects unknown fields", () => {
  assert.equal(validateSchema(validScene()), true);
  assert.equal(validateSchema(validScene({ version: 2 })), false);
  assert.equal(validateSchema(validScene({ unexpected: true })), false);
});

test("seek renders exact state without scheduling frames and debug mode exposes the rig", {
  skip: process.env.SKIP_BROWSER === "1" ? "SKIP_BROWSER=1" : false,
}, async () => {
  assert.ok(chromiumStatus.installed, INSTALL_MESSAGE);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><div id="stage">original content</div>');
    await page.addScriptTag({ path: path.resolve(__dirname, "../src/runtime/mascot-motion.js") });
    const result = await page.evaluate(() => {
      const stage = document.querySelector("#stage");
      let nextFrame = 0;
      const pendingFrames = new Map();
      const originalRequest = window.requestAnimationFrame;
      const originalCancel = window.cancelAnimationFrame;
      window.requestAnimationFrame = (callback) => {
        const id = ++nextFrame;
        pendingFrames.set(id, callback);
        return id;
      };
      window.cancelAnimationFrame = (id) => pendingFrames.delete(id);
      const config = {
        width: 100,
        height: 100,
        debug: true,
        layers: [
          { id: "body", src: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1'%20height='1'/%3E" },
          { id: "head", src: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1'%20height='1'/%3E", parent: "body", origin: [0.5, 0.25] },
        ],
        animations: {
          move: {
            duration: 2,
            loop: false,
            easing: "linear",
            tracks: {
              body: [{ at: 0, x: 0 }, { at: 1, x: 100 }],
              head: [{ at: 0, rotateZ: 0 }, { at: 1, rotateZ: 20 }],
            },
          },
        },
      };
      const controller = MascotMotion.mount(stage, config);
      controller.play("move");
      const framesBeforeSeek = pendingFrames.size;
      controller.seek(0.5);
      const halfway = controller.getState("body");
      const framesAfterSeek = pendingFrames.size;
      controller.seek({ time: 0.5 });
      const quarter = controller.getState("body");
      const headAtQuarter = controller.getState("head");
      quarter.x = -1;
      const copiedState = controller.getState("body");
      const debug = {
        bounds: stage.querySelectorAll('[data-mascot-debug="bounds"]').length,
        pivots: stage.querySelectorAll('[data-mascot-debug="pivot"]').length,
        labels: [...stage.querySelectorAll('[data-mascot-debug="label"]')].map((label) => label.textContent),
        parentLines: stage.querySelectorAll('[data-mascot-debug="parents"] line').length,
      };
      controller.destroy();
      window.requestAnimationFrame = originalRequest;
      window.cancelAnimationFrame = originalCancel;
      return {
        framesBeforeSeek,
        framesAfterSeek,
        halfwayX: halfway.x,
        timeSeekX: copiedState.x,
        timeSeekRotation: headAtQuarter.rotateZ,
        debug,
        restoredContent: stage.textContent,
      };
    });

    assert.equal(result.framesBeforeSeek, 1);
    assert.equal(result.framesAfterSeek, 0);
    assert.equal(result.halfwayX, 50);
    assert.equal(result.timeSeekX, 25);
    assert.equal(result.timeSeekRotation, 5);
    assert.deepEqual(result.debug, {
      bounds: 2,
      pivots: 2,
      labels: ["body", "head ← body"],
      parentLines: 1,
    });
    assert.equal(result.restoredContent, "original content");
  } finally {
    await browser.close();
  }
});

test("motion checks report static animation, missing tracks, and extreme values", () => {
  const scene = validScene({
    layers: [
      { id: "body", src: "image.png" },
      { id: "eye", src: "eye.png" },
    ],
    animations: {
      move: {
        duration: 1,
        loop: false,
        tracks: {
          body: [{ at: 0, rotateZ: 270, scaleX: 0.05 }, { at: 1, rotateZ: 270, scaleX: 0.05 }],
        },
      },
    },
  });
  const normalized = validateScene(scene);
  const samples = sampleProgress(normalized.animations.move).map((at) => ({
    at,
    layers: {
      body: {
        state: { x: 0, y: 0, rotateZ: 270, scaleX: 0.05 },
        bounds: { left: 0, top: at === 0.5 ? -10 : 0, right: 100, bottom: 100 },
      },
      eye: {
        state: {},
        bounds: { left: 0, top: at === 0.5 ? -10 : 0, right: 100, bottom: 100 },
      },
    },
  }));
  const issues = analyzeMotion(normalized, "move", samples);
  assert.ok(issues.some((issue) => issue.message.includes('layer "eye" has no track')));
  assert.ok(issues.some((issue) => issue.message.includes("no measurable movement")));
  assert.ok(issues.some((issue) => issue.message.includes("270°")));
  assert.ok(issues.some((issue) => issue.message.includes("scaleX 0.05")));
  assert.ok(issues.some((issue) => issue.message.includes('layer "body" leaves the canvas at 0.500')));
  assert.ok(issues.some((issue) => issue.message.includes('layer "eye" leaves the canvas at 0.500')));
});

test("motion checks report transient transform extremes at sampled progress", () => {
  const scene = validateScene(validScene({
    animations: {
      move: {
        duration: 1,
        loop: false,
        tracks: { body: [{ at: 0, rotateZ: 0 }, { at: 1, rotateZ: 170 }] },
      },
    },
  }));
  const samples = [0, 0.5, 1].map((at) => ({
    at,
    layers: {
      body: {
        state: { rotateX: 0, rotateY: 0, rotateZ: at === 0.5 ? 181 : at * 170, scaleX: 1, scaleY: 1, scaleZ: 1 },
        bounds: { left: 0, top: 0, right: 100, bottom: 100 },
      },
    },
  }));
  const issues = analyzeMotion(scene, "move", samples);
  assert.ok(issues.some((issue) => issue.message.includes('at progress 0.500 has extreme rotateZ 181°')));
});
