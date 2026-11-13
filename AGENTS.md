# Mascot animation workflow for coding agents

When asked to animate a mascot in this repository, use `mascot-motion.js` as
the default runtime and follow the workflow below.

## Image-to-animation requests

- Treat an image attached to the user's coding-agent request as the source
  artwork. The user should not need to upload it again to Mascot Motion Studio,
  split it into parts, identify shapes, or set pivots.
- Inspect the image and the existing project first. If the user names an HTML
  file, update that file in place and preserve its existing content and
  behavior. Otherwise, integrate with the relevant existing page; create a
  standalone HTML page only when the project has no suitable target or the user
  asks for one.
- Default to animating a single flattened image as a whole. Only create
  independently moving parts when transparent boundaries, source layers, or
  reliable automatic image analysis make the separation convincing and useful.
  Preserve the original artwork; never invent movable limbs or ask the user to
  mark shapes as a prerequisite. If a necessary visual distinction cannot be
  inferred, use whole-image motion and explain the limitation.
- Use `mascot-motion.js` when it is present and fits the target page. For a
  standalone HTML deliverable or a simple effect, prefer a small self-contained
  CSS/JavaScript implementation over adding dependencies or making the user
  assemble a separate runtime bundle.
- Implement the requested result in the project, not just a prompt, scene JSON,
  or implementation instructions. Make sure the image path resolves and the
  HTML can be opened or run using the project's existing workflow.
- Preview the actual target page and image at its intended size. Verify that
  the animation visibly changes over time, looping motion returns cleanly to
  its initial pose (or a one-shot action settles and stops), controls work,
  reduced-motion preferences are respected, and the browser console has no
  relevant errors. Report what was changed and how it was checked.

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
`destroy()`, and read-only `animation` and `layerIds` properties. Invalid scene
data throws a descriptive error; missing images dispatch a
`mascotmotion:error` event from the mount element.

## Delivery checks

- Preview the motion in a browser at the target size and verify that images
  load, pivots feel attached, and the action reads clearly.
- Test looping clips across the loop boundary and check the reduced-motion
  behavior. The runtime validates that looping tracks return to their starting
  pose; use `loop: false` for one-shot actions.
- Keep each animation in a named clip so the host application can choose when
  to play it.
