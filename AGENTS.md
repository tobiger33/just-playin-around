# Animation workflow for coding agents

When asked to add animation to code or animate a mascot, inspect the target
project and use `mascot-motion.js` only when it fits the existing stack.

## Work from code, artwork, or project context

- Work from any code, files, snippets, selected editor content, or image the
  user provides; an image is optional. Inspect the project to identify its
  language, framework, entry points, and existing animation/rendering approach.
- Modify the user's named or selected source in its existing language and
  framework. This includes HTML/CSS/JavaScript, TypeScript, UI components, SVG,
  canvas, and other supported project code. Do not replace a component or
  application with an unrelated HTML demo. Preserve existing behavior and
  conventions.
- If the user asks for an HTML page, update the specified page or create one
  when appropriate. Create a standalone HTML deliverable only when requested
  or when the project has no suitable existing target and HTML fits the task.
- Use an attached image directly when one is provided, but do not require a
  separate Studio upload, manual part splitting, shape marking, or pivot setup.
- Default to animating a single flattened image as a whole. Only create
  independently moving parts when transparent boundaries, source layers, or
  reliable automatic image analysis make the separation convincing and useful.
  Preserve the original artwork; never invent movable limbs or ask the user to
  mark shapes as a prerequisite. If a necessary visual distinction cannot be
  inferred, use whole-image motion and explain the limitation.
- Choose an implementation that fits the target: use `mascot-motion.js` for
  compatible DOM image-layer scenes; otherwise use the project's native
  animation APIs and existing dependencies. Avoid adding dependencies when the
  current stack can do the job.
- Implement the requested result in project files, not just a prompt, scene
  JSON, or implementation instructions. Keep existing project workflows and
  make any new asset paths resolve.
- Run the most relevant project checks. For browser interfaces, preview the
  actual target at its intended size and verify visible movement, a clean loop
  boundary or one-shot settle, working controls, reduced-motion behavior, and
  no relevant console errors. Report what changed and how it was checked.

## Artwork and rigging

- Inspect the supplied artwork before choosing a motion or rig.
- A single flattened image supports whole-character motion, including
  perspective, rotation, squash-and-stretch, and translation. Do not imply that
  separate limbs or facial features can move independently if they are not
  separate layers.
- For articulated gestures, use transparent image parts aligned on a common
  canvas. Give every part an `id`, image `src`, and pivot `origin: [x, y]` in
  normalized fractions. Use `parent` to build a hierarchy when a child should
  follow a joint.
- Preserve the uploaded artwork and its proportions. Do not copy another
  company's mascot or artwork from a named animation reference; use references
  only for broad qualities such as timing, energy, or clarity.

## Motion design

- Prefer a few readable poses over constant motion. For expressive actions,
  choreograph anticipation, a clear main action, overlapping follow-through,
  and a settle.
- Use `rotateX`, `rotateY`, `rotateZ`, and `z` for perspective-based 3D motion.
  Set `perspective` on the scene and use pivots that match the character's
  joints.
- Use `backOut` or `spring` selectively for overshoot; avoid applying bounce
  indiscriminately to every layer.
- Make repeating clips seamless: the first and last poses should match. Keep
  one-shot actions non-looping unless the request calls for a loop.
- Respect `prefers-reduced-motion`. Keep the initial pose meaningful when
  motion is reduced.

## Runtime API

Load the runtime with `<script src="mascot-motion.js"></script>`, then mount a
scene:

```js
const mascot = MascotMotion.mount(document.querySelector("#stage"), {
  width: 512,
  height: 512,
  perspective: 800,
  layers: [
    { id: "body", src: "assets/body.png", origin: [0.5, 0.58] },
    { id: "head", src: "assets/head.png", parent: "body", origin: [0.5, 0.4] },
    { id: "wing", src: "assets/wing.png", parent: "body", origin: [0.2, 0.6] },
  ],
  animations: {
    idle: {
      duration: 2,
      loop: true,
      easing: "easeInOut",
      tracks: {
        body: [
          { at: 0, y: 0, scaleY: 1 },
          { at: 0.5, y: -4, scaleY: 1.02 },
          { at: 1, y: 0, scaleY: 1 },
        ],
        head: [
          { at: 0, rotateZ: 0 },
          { at: 0.5, rotateZ: -3 },
          { at: 1, rotateZ: 0 },
        ],
      },
    },
  },
});

mascot.play("idle");
```

Keyframes use normalized `at` times from `0` to `1`. Transform values are
pixels, degrees, or scale factors. Supported animated properties are `x`, `y`,
`z`, `rotateX`, `rotateY`, `rotateZ`, `scaleX`, `scaleY`, `scaleZ`, and
`opacity`. Supported easings are `linear`, `easeInOut`, `easeOutCubic`,
`backOut`, and `spring`.

The controller provides `play(name)`, `pause()`, `resume()`, `stop()`,
`seek(progress)` (normalized `0..1`), `seek({ time })` (seconds), `getState(id)`,
`destroy()`, and read-only `animation` and `layerIds` properties. Seeking
cancels playback and renders synchronously without scheduling a frame. Seeking
by time wraps looping clips and clamps one-shots. `MascotMotion.validateScene`
validates scene data without mounting it. Invalid scene data throws a
descriptive error; missing images dispatch a `mascotmotion:error` event from
the mount element.

Set `debug: true` in the scene to show layer bounds, IDs, pivots, and parent
connectors. The Studio provides a frame scrubber and debug toggle for uploaded
preview artwork.

## M1 verification harness

Install the pinned development dependencies and browser once:

```sh
npm install
npx playwright install chromium
```

Validate a scene and its local image paths/dimensions:

```sh
npm run validate-scene -- --scene path/to/scene.json
```

Render deterministic frames and a labeled SVG contact sheet:

```sh
npm run frames -- --scene path/to/scene.json --anim idle --at 0,0.25,0.5,0.75,1
```

Run the runtime tests, fixture validation, and frame render together:

```sh
npm run verify
```

The verification command prints the contact-sheet path. `MascotMotion` is
available as a browser global and a CommonJS export for Node-based validation.

## Delivery checks

- Preview the motion in a browser at the target size and verify that images
  load, pivots feel attached, and the action reads clearly.
- Test looping clips across the loop boundary and check the reduced-motion
  behavior. The runtime validates that looping tracks return to their starting
  pose; use `loop: false` for one-shot actions.
- For deterministic inspection, use `seek()` and `npm run frames`; check every
  contact-sheet frame and the debug overlay before integrating the scene.
- Keep each animation in a named clip so the host application can choose when
  to play it.
