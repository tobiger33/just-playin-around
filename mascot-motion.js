(function (global) {
  "use strict";

  const DEFAULT_STATE = Object.freeze({
    x: 0,
    y: 0,
    z: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    opacity: 1,
  });

  const EASINGS = {
    linear: (value) => value,
    easeInOut: (value) => value * value * (3 - 2 * value),
    easeOutCubic: (value) => 1 - (1 - value) ** 3,
    backOut: (value) => {
      const overshoot = 1.70158;
      return 1 + (overshoot + 1) * (value - 1) ** 3 + overshoot * (value - 1) ** 2;
    },
    spring: (value) => 1 - Math.exp(-7 * value) * Math.cos(11 * value),
  };
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function assert(condition, message) {
    if (!condition) {
      throw new TypeError(`MascotMotion: ${message}`);
    }
  }

  function normalizeLayer(layer, index, ids) {
    assert(layer && typeof layer === "object", `layers[${index}] must be an object.`);
    assert(typeof layer.id === "string" && layer.id.trim(), `layers[${index}] needs a non-empty id.`);
    assert(!ids.has(layer.id), `duplicate layer id "${layer.id}".`);
    assert(typeof layer.src === "string" && layer.src, `layer "${layer.id}" needs an image src.`);

    const origin = layer.origin || [0.5, 0.5];
    assert(
      Array.isArray(origin) && origin.length >= 2 && origin.slice(0, 2).every(Number.isFinite),
      `layer "${layer.id}" origin must be [x, y] fractions.`,
    );
    assert(
      origin.length < 3 || Number.isFinite(origin[2]),
      `layer "${layer.id}" origin depth must be a finite number.`,
    );
    assert(
      origin[0] >= 0 && origin[0] <= 1 && origin[1] >= 0 && origin[1] <= 1,
      `layer "${layer.id}" origin fractions must be between 0 and 1.`,
    );

    const normalized = {
      id: layer.id,
      src: layer.src,
      parent: layer.parent || null,
      x: layer.x || 0,
      y: layer.y || 0,
      width: layer.width === undefined ? 100 : layer.width,
      height: layer.height === undefined ? 100 : layer.height,
      origin: [origin[0], origin[1], origin[2] || 0],
      zIndex: layer.zIndex === undefined ? index : layer.zIndex,
      alt: layer.alt || "",
    };
    for (const key of ["x", "y", "width", "height", "zIndex"]) {
      assert(Number.isFinite(normalized[key]), `layer "${layer.id}" ${key} must be a finite number.`);
    }
    assert(normalized.width > 0 && normalized.height > 0, `layer "${layer.id}" dimensions must be positive.`);
    ids.add(layer.id);
    return normalized;
  }

  function normalizeAnimations(animations, layerIds) {
    assert(animations && typeof animations === "object", "animations must be an object.");
    const result = Object.create(null);
    for (const [name, animation] of Object.entries(animations)) {
      assert(animation && typeof animation === "object", `animation "${name}" must be an object.`);
      assert(Number.isFinite(animation.duration) && animation.duration > 0, `animation "${name}" needs a positive duration.`);
      assert(animation.tracks && typeof animation.tracks === "object", `animation "${name}" needs tracks.`);
      const easing = animation.easing || "easeInOut";
      assert(hasOwn(EASINGS, easing), `unknown easing "${easing}" in animation "${name}".`);
      const tracks = Object.create(null);
      for (const [layerId, frames] of Object.entries(animation.tracks)) {
        assert(layerIds.has(layerId), `animation "${name}" targets unknown layer "${layerId}".`);
        assert(Array.isArray(frames) && frames.length > 0, `track "${layerId}" in "${name}" needs keyframes.`);
        let previousAt = -1;
        tracks[layerId] = frames.map((frame, index) => {
          assert(frame && typeof frame === "object", `keyframe ${index} for "${layerId}" must be an object.`);
          assert(Number.isFinite(frame.at) && frame.at >= 0 && frame.at <= 1, `keyframe ${index} for "${layerId}" needs at between 0 and 1.`);
          assert(frame.at > previousAt, `keyframes for "${layerId}" must be ordered by at.`);
          previousAt = frame.at;
          const normalized = { at: frame.at, easing: frame.easing || easing };
          assert(hasOwn(EASINGS, normalized.easing), `unknown easing "${normalized.easing}" in "${name}".`);
          for (const [property, value] of Object.entries(frame)) {
            if (property === "at" || property === "easing") continue;
            assert(hasOwn(DEFAULT_STATE, property), `unsupported property "${property}" in "${name}".`);
            assert(Number.isFinite(value), `"${property}" values in "${name}" must be finite numbers.`);
            normalized[property] = value;
          }
          return normalized;
        });
      }
      result[name] = {
        duration: animation.duration,
        loop: animation.loop !== false,
        easing,
        tracks,
      };
    }
    assert(Object.keys(result).length > 0, "define at least one animation.");
    return result;
  }

  function interpolate(frames, progress, easing) {
    function completeState(frame) {
      return Object.fromEntries(
        Object.keys(DEFAULT_STATE).map((property) => [
          property,
          frame[property] === undefined ? DEFAULT_STATE[property] : frame[property],
        ]),
      );
    }

    if (progress <= frames[0].at) return completeState(frames[0]);
    const last = frames[frames.length - 1];
    if (progress >= last.at) return completeState(last);

    let rightIndex = 1;
    while (frames[rightIndex].at < progress) rightIndex += 1;
    const left = frames[rightIndex - 1];
    const right = frames[rightIndex];
    const segmentProgress = (progress - left.at) / (right.at - left.at);
    const blend = EASINGS[left.easing || easing](segmentProgress);
    const state = {};
    for (const property of Object.keys(DEFAULT_STATE)) {
      const start = left[property] === undefined ? DEFAULT_STATE[property] : left[property];
      const end = right[property] === undefined ? start : right[property];
      state[property] = start + (end - start) * blend;
    }
    return state;
  }

  function applyState(element, state) {
    element.style.opacity = String(state.opacity);
    element.style.transform =
      `translate3d(${state.x}px, ${state.y}px, ${state.z}px) ` +
      `rotateX(${state.rotateX}deg) rotateY(${state.rotateY}deg) rotateZ(${state.rotateZ}deg) ` +
      `scale3d(${state.scaleX}, ${state.scaleY}, ${state.scaleZ})`;
  }

  function mount(stage, config) {
    assert(stage instanceof HTMLElement, "mount target must be an HTML element.");
    assert(config && typeof config === "object", "scene config must be an object.");
    assert(Number.isFinite(config.width) && config.width > 0, "scene width must be positive.");
    assert(Number.isFinite(config.height) && config.height > 0, "scene height must be positive.");
    assert(Array.isArray(config.layers) && config.layers.length > 0, "scene needs at least one image layer.");

    const ids = new Set();
    const layers = config.layers.map((layer, index) => normalizeLayer(layer, index, ids));
    const animations = normalizeAnimations(config.animations, ids);
    const layerById = new Map(layers.map((layer) => [layer.id, layer]));
    for (const layer of layers) {
      assert(!layer.parent || layerById.has(layer.parent), `layer "${layer.id}" has unknown parent "${layer.parent}".`);
      assert(layer.parent !== layer.id, `layer "${layer.id}" cannot parent itself.`);
    }

    const perspective = config.perspective === undefined ? 800 : config.perspective;
    assert(Number.isFinite(perspective) && perspective > 0, "perspective must be positive.");
    const previousStage = {
      children: Array.from(stage.childNodes),
      style: stage.getAttribute("style"),
      role: stage.getAttribute("role"),
      label: stage.getAttribute("aria-label"),
    };
    stage.replaceChildren();
    stage.style.position = "relative";
    stage.style.overflow = "visible";
    stage.style.aspectRatio = `${config.width} / ${config.height}`;
    stage.style.perspective = `${perspective}px`;
    stage.style.transformStyle = "preserve-3d";
    stage.setAttribute("role", "img");
    stage.setAttribute("aria-label", config.label || "Animated mascot");

    const nodes = new Map();
    const building = new Set();

    function buildLayer(layer) {
      if (nodes.has(layer.id)) return nodes.get(layer.id);
      assert(!building.has(layer.id), `layer hierarchy contains a cycle at "${layer.id}".`);
      building.add(layer.id);

      const parent = layer.parent ? buildLayer(layerById.get(layer.parent)) : stage;
      const joint = document.createElement("div");
      joint.dataset.mascotLayer = layer.id;
      joint.style.position = "absolute";
      joint.style.left = `${layer.x}%`;
      joint.style.top = `${layer.y}%`;
      joint.style.width = `${layer.width}%`;
      joint.style.height = `${layer.height}%`;
      joint.style.zIndex = String(layer.zIndex);
      joint.style.transformOrigin = `${layer.origin[0] * 100}% ${layer.origin[1] * 100}% ${layer.origin[2] || 0}px`;
      joint.style.transformStyle = "preserve-3d";
      joint.style.willChange = "transform, opacity";

      const image = document.createElement("img");
      image.src = layer.src;
      image.alt = layer.alt;
      image.draggable = false;
      image.decoding = "async";
      image.style.display = "block";
      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "fill";
      image.addEventListener("error", () => {
        stage.dispatchEvent(
          new CustomEvent("mascotmotion:error", {
            bubbles: true,
            detail: { layer: layer.id, src: layer.src },
          }),
        );
      });
      joint.append(image);
      parent.append(joint);
      nodes.set(layer.id, joint);
      building.delete(layer.id);
      return joint;
    }

    for (const layer of layers) buildLayer(layer);

    const reduceMotion = global.matchMedia("(prefers-reduced-motion: reduce)");
    let animationName = null;
    let elapsed = 0;
    let previousTime = null;
    let frameId = null;
    let destroyed = false;
    let paused = true;

    function renderAt(progress) {
      const animation = animations[animationName];
      for (const layer of layers) {
        const element = nodes.get(layer.id);
        const frames = animation.tracks[layer.id];
        applyState(element, frames ? interpolate(frames, progress, animation.easing) : DEFAULT_STATE);
      }
    }

    function tick(now) {
      if (destroyed || paused) return;
      if (previousTime !== null) elapsed += now - previousTime;
      previousTime = now;
      const animation = animations[animationName];
      const duration = animation.duration * 1000;
      const progress = animation.loop ? (elapsed % duration) / duration : Math.min(elapsed / duration, 1);
      renderAt(progress);
      if (!animation.loop && elapsed >= duration) {
        paused = true;
        previousTime = null;
        return;
      }
      frameId = requestAnimationFrame(tick);
    }

    function cancelFrame() {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      previousTime = null;
    }

    function onMotionPreferenceChange(event) {
      if (!event.matches || !animationName) return;
      cancelFrame();
      paused = true;
      elapsed = 0;
      renderAt(0);
    }

    reduceMotion.addEventListener("change", onMotionPreferenceChange);

    const controller = {
      play(name, options = {}) {
        assert(!destroyed, "cannot play a destroyed scene.");
        assert(animations[name], `unknown animation "${name}".`);
        animationName = name;
        if (options.restart !== false) elapsed = 0;
        cancelFrame();
        paused = true;
        renderAt(reduceMotion.matches ? 0 : (elapsed % (animations[name].duration * 1000)) / (animations[name].duration * 1000));
        if (!reduceMotion.matches) {
          paused = false;
          frameId = requestAnimationFrame(tick);
        }
        return controller;
      },
      pause() {
        if (!paused) {
          paused = true;
          cancelFrame();
        }
        return controller;
      },
      resume() {
        assert(!destroyed, "cannot resume a destroyed scene.");
        if (animationName && paused && !reduceMotion.matches) {
          paused = false;
          frameId = requestAnimationFrame(tick);
        }
        return controller;
      },
      stop() {
        paused = true;
        cancelFrame();
        elapsed = 0;
        animationName = null;
        for (const element of nodes.values()) applyState(element, DEFAULT_STATE);
        return controller;
      },
      destroy() {
        if (destroyed) return;
        controller.stop();
        destroyed = true;
        reduceMotion.removeEventListener("change", onMotionPreferenceChange);
        stage.replaceChildren(...previousStage.children);
        if (previousStage.style === null) stage.removeAttribute("style");
        else stage.setAttribute("style", previousStage.style);
        if (previousStage.role === null) stage.removeAttribute("role");
        else stage.setAttribute("role", previousStage.role);
        if (previousStage.label === null) stage.removeAttribute("aria-label");
        else stage.setAttribute("aria-label", previousStage.label);
        nodes.clear();
      },
      get animation() {
        return animationName;
      },
      get layerIds() {
        return layers.map((layer) => layer.id);
      },
    };

    if (config.autoplay) controller.play(config.autoplay);
    return controller;
  }

  global.MascotMotion = Object.freeze({ mount, easings: Object.keys(EASINGS) });
})(globalThis);
