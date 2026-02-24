# VectorFlow

A minimal, JSON-driven SVG pose animation library.

[![npm version](https://img.shields.io/npm/v/@nitesh-tyagi/vectorflow.svg)](https://www.npmjs.com/package/@nitesh-tyagi/vectorflow)
[![license](https://img.shields.io/npm/l/@nitesh-tyagi/vectorflow.svg)](LICENSE)
[![Try the Demo](https://img.shields.io/badge/demo-Live%20Player-e94560?style=flat-square)](https://vectorflow.webmuffin.io/)

---

## What is VectorFlow?

VectorFlow loads an SVG containing multiple **pose states** and a JSON config defining **routes** and **actions**, then animates smoothly between poses using attribute interpolation. No path morphing, no crossfades — just clean, transform-and-attribute-based transitions.

**Features:**

- Declarative JSON config — define states, routes, and actions
- Smooth SVG attribute interpolation (position, size, color, transform)
- Sequence and loop action types with cancellation support
- Clean public API with event system
- Zero-config playback — just load SVG + JSON and go
- ~29 KB UMD bundle (including anime.js)

---

## Table of Contents

- [Quick Start](#quick-start)
- [Live Demo](#live-demo)
- [Preparing Your SVG](#preparing-your-svg)
- [Writing the JSON Config](#writing-the-json-config)
- [Sample Files](#sample-files)
- [API Reference](#api-reference)
- [Full Example](#full-example)
- [Links](#links)
- [License](#license)

---

## Quick Start

### Install

```bash
npm install @nitesh-tyagi/vectorflow
```

### Browser (UMD)

```html
<script src="https://unpkg.com/@nitesh-tyagi/vectorflow/dist/vectorflow.umd.js"></script>
<script>
  const vf = new VectorFlow({
    svgElement: document.querySelector('svg'),
    json: config,
  });
  vf.play('shuffle');
</script>
```

### ES Module

```js
import VectorFlow from '@nitesh-tyagi/vectorflow';

const vf = new VectorFlow({
  svgElement: document.querySelector('#my-svg'),
  json: configObject, // or a JSON string
});

vf.play('left');       // play an action
vf.play('shuffle');    // auto-cancels previous, starts new
vf.stop();             // cancel current playback
```

---

## Live Demo

Try VectorFlow instantly — no install required:

**[vectorflow.webmuffin.io](https://vectorflow.webmuffin.io/)**

1. Download the [sample SVG](https://github.com/Nitesh-WebMuffin/SVG-Animator/blob/main/demo-files/Shapes.svg) and [sample JSON](https://github.com/Nitesh-WebMuffin/SVG-Animator/blob/main/demo-files/Shapes.json)
2. Open the [Demo Player](https://vectorflow.webmuffin.io/)
3. Upload both files and click **Load & Play**
4. Use the action buttons to trigger animations

The demo player source is at [Nitesh-WebMuffin/SVG-Animator](https://github.com/Nitesh-WebMuffin/SVG-Animator).

---

## Preparing Your SVG

VectorFlow discovers animation states and parts directly from your SVG markup. Follow these rules when creating your SVG:

### 1. Define State Groups

Wrap each pose/state in a `<g>` (group) element with an `id` of the form `state_{name}`:

```xml
<g id="state_left">   <!-- state name: "left" -->
  ...
</g>
<g id="state_center"> <!-- state name: "center" -->
  ...
</g>
<g id="state_right">  <!-- state name: "right" -->
  ...
</g>
```

- The `state_` prefix is **required**. Everything after it becomes the state name used in your JSON config.
- You can have as many states as you need.

### 2. Tag Parts with `data-part`

Inside each state group, mark the elements that should be animated with a `data-part` attribute:

```xml
<g id="state_left">
  <rect data-part="body" x="20" y="80" width="40" height="40" fill="red" />
  <circle data-part="head" cx="40" cy="60" r="15" fill="orange" />
</g>
```

- VectorFlow matches parts **by name** across states. A part called `"body"` in `state_left` will animate to the `"body"` in `state_right`.
- Part names must be **identical** across all states.

### 3. Keep Part Sets Consistent

**Every state group must contain the exact same set of `data-part` names.** If `state_left` has parts `body` and `head`, then `state_center` and `state_right` must also have `body` and `head`.

VectorFlow will throw an error if part sets don't match:

```
VectorFlow: Part mismatch between states. State "left" has parts [body,head]
but state "right" has parts [body].
```

### 4. Animatable Attributes

VectorFlow interpolates the following SVG attributes and properties between states:

| Type | Attributes / Properties |
|------|------------------------|
| **Numeric** | `x`, `y`, `width`, `height`, `rx`, `ry`, `cx`, `cy`, `r`, `opacity` |
| **Colors** | `fill`, `stroke` (hex `#RGB`/`#RRGGBB` or `rgb()`) |
| **Transforms** | `translate(x,y)`, `scale(x,y)`, `rotate(angle)` |

Design your states so that the visual differences are expressed through these attributes. For example, to move a shape left, change its `x`; to recolor it, change its `fill`.

### 5. Minimal SVG Template

```xml
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <!-- State: left -->
  <g id="state_left">
    <rect data-part="shape" x="20" y="80" width="40" height="40" fill="#e74c3c" />
  </g>

  <!-- State: center -->
  <g id="state_center">
    <rect data-part="shape" x="80" y="80" width="40" height="40" fill="#3498db" />
  </g>

  <!-- State: right -->
  <g id="state_right">
    <rect data-part="shape" x="140" y="80" width="40" height="40" fill="#2ecc71" />
  </g>
</svg>
```

> **Tip:** At runtime, VectorFlow hides all state groups and creates a single `<g id="live_character">` clone to animate. Your original state groups serve as snapshots defining each pose.

---

## Writing the JSON Config

The JSON config tells VectorFlow which state to start in, how to transition between states, and what actions are available.

### Top-Level Structure

```json
{
  "name": "my-animation",
  "initial_state": "center",
  "ms": 120,
  "routes": { ... },
  "actions": { ... }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | No | A label for this config (for your own reference). |
| `initial_state` | `string` | **Yes** | The state name to start in (must match an `id="state_..."` in your SVG). |
| `ms` | `number` | No | Default animation duration in milliseconds (default: `120`). |
| `routes` | `object` | **Yes** | Defines how to travel between states. |
| `actions` | `object` | **Yes** | Named animation sequences/loops that users can trigger. |

### Routes

Routes define the **path** the animation takes when transitioning to a target state. Each route key is a target and its value maps source states (or `"*"` for any source) to an array of intermediate + destination states.

```json
"routes": {
  "left": {
    "*": ["left"],
    "right": ["center", "left"]
  },
  "right": {
    "*": ["right"],
    "left": ["center", "right"]
  },
  "center": {
    "*": ["center"],
    "ms": 60
  }
}
```

**How route resolution works:**

1. When the engine needs to go to `"left"` from the current state, it looks up `routes["left"]`.
2. If there's a specific entry for the current state (e.g. `"right": ["center", "left"]`), it follows that path — first animate to `center`, then to `left`.
3. If no specific entry exists, it uses the wildcard `"*"` path.
4. If no route exists at all, VectorFlow jumps directly to the target state.

**Route-level `ms`:** You can set a per-route `ms` to override the global duration for transitions to that target state.

**Route keys vs state names:** Route keys don't have to match a state name. You can create alias routes that resolve to real states:

```json
"routes": {
  "direct-left": { "*": ["left"] },
  "direct-right": { "*": ["right"] }
}
```

Here `"direct-left"` is a route key (not a state) that resolves to state `"left"`. This is useful for defining multiple paths to the same state.

### Actions

Actions are the named animations you trigger via `vf.play('actionName')`. Each action has a type — either `"sequence"` (play once) or `"loop"` (repeat).

```json
"actions": {
  "left":    { "type": "sequence", "order": ["left"] },
  "right":   { "type": "sequence", "order": ["right"] },
  "center":  { "type": "sequence", "order": ["center"] },
  "shuffle": {
    "type": "loop",
    "mode": "direct",
    "order": ["left", "center", "right", "center"],
    "ms": 80,
    "count": 99999
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | `"sequence" \| "loop"` | `"sequence"` | `sequence` plays once; `loop` repeats `count` times. |
| `order` | `string[]` | — | Array of route keys or state names to visit in order. |
| `ms` | `number` | — | Override animation duration for this action (takes highest priority). |
| `mode` | `"direct"` | — | If `"direct"`, skips intermediate route steps — jumps straight to the final resolved state. |
| `count` | `number` | `99999` | For loops: how many times to repeat the order cycle. |

**`order` items can be route keys or state names.** The engine resolves each entry through the routes table. If an entry matches a route key, VectorFlow follows that route's path. If it matches a state name directly, it goes there.

### Duration Precedence

When determining how long a step takes, VectorFlow checks in this order:

```
action.ms  >  routes[target].ms  >  json.ms  >  120ms (fallback)
```

### Full JSON Example

```json
{
  "name": "character",
  "initial_state": "idle",
  "ms": 150,
  "routes": {
    "idle":       { "*": ["idle"] },
    "walk-left":  { "*": ["lean-left", "walk-left"], "walk-right": ["idle", "lean-left", "walk-left"] },
    "walk-right": { "*": ["lean-right", "walk-right"], "walk-left": ["idle", "lean-right", "walk-right"] },
    "lean-left":  { "*": ["lean-left"], "ms": 80 },
    "lean-right": { "*": ["lean-right"], "ms": 80 }
  },
  "actions": {
    "go-left":    { "type": "sequence", "order": ["walk-left"] },
    "go-right":   { "type": "sequence", "order": ["walk-right"] },
    "reset":      { "type": "sequence", "order": ["idle"], "ms": 200 },
    "patrol":     { "type": "loop", "order": ["walk-left", "idle", "walk-right", "idle"], "count": 10 }
  }
}
```

---

## Sample Files

Ready-to-use sample files are available in the [demo-files](https://github.com/Nitesh-WebMuffin/SVG-Animator/tree/main/demo-files) folder:

| File | Description |
|------|-------------|
| [`Shapes.svg`](https://github.com/Nitesh-WebMuffin/SVG-Animator/blob/main/demo-files/Shapes.svg) | SVG with 3 pose states: left, center, right |
| [`Shapes.json`](https://github.com/Nitesh-WebMuffin/SVG-Animator/blob/main/demo-files/Shapes.json) | JSON config with routes, actions, and a shuffle loop |

Download both and pass them to VectorFlow, or upload them to the [Live Demo Player](https://vectorflow.webmuffin.io/).

---

## API Reference

### Constructor

```js
const vf = new VectorFlow({ svgElement, json });
```

| Param | Type | Description |
|-------|------|-------------|
| `svgElement` | `SVGElement \| string` | An SVG DOM element or raw SVG string. |
| `json` | `object \| string` | VectorFlow JSON config (object or JSON string). |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `vf.states` | `string[]` | All discovered state names from the SVG. |
| `vf.currentState` | `string` | The current active state. |
| `vf.actions` | `object` | Actions config from the JSON. |
| `vf.isPlaying` | `boolean` | Whether an action is currently playing. |
| `vf.currentAction` | `string \| null` | Name of the playing action, or `null`. |
| `vf.svgElement` | `SVGElement` | The SVG element being animated. |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `vf.play(actionName)` | `Promise<void>` | Play a named action. Auto-cancels any running action. |
| `vf.stop()` | `void` | Cancel current playback immediately. |
| `vf.on(event, callback)` | `VectorFlow` | Register an event listener (chainable). |
| `vf.off(event, callback)` | `VectorFlow` | Remove an event listener (chainable). |
| `vf.destroy()` | `void` | Stop playback, restore original SVG state groups, remove listeners. |

### Events

| Event | Callback Arg | Description |
|-------|-------------|-------------|
| `stateChange` | `string` | Fired after each intermediate step completes (receives the new state name). |
| `actionStart` | `string` | Fired when an action begins playing. |
| `actionEnd` | `string` | Fired when an action finishes naturally or is cancelled. |
| `error` | `Error` | Fired on runtime errors during playback. |

```js
vf.on('stateChange', (state) => {
  console.log('Now in state:', state);
});

vf.on('actionEnd', (actionName) => {
  console.log(`Action "${actionName}" finished`);
});
```

---

## Full Example

### SVG (`character.svg`)

```xml
<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
  <g id="state_left">
    <rect data-part="body" x="30" y="60" width="50" height="80" rx="8" fill="#e74c3c" />
    <circle data-part="head" cx="55" cy="45" r="18" fill="#f5b041" />
  </g>
  <g id="state_center">
    <rect data-part="body" x="125" y="60" width="50" height="80" rx="8" fill="#3498db" />
    <circle data-part="head" cx="150" cy="45" r="18" fill="#f5b041" />
  </g>
  <g id="state_right">
    <rect data-part="body" x="220" y="60" width="50" height="80" rx="8" fill="#2ecc71" />
    <circle data-part="head" cx="245" cy="45" r="18" fill="#f5b041" />
  </g>
</svg>
```

### JSON (`character.json`)

```json
{
  "name": "character",
  "initial_state": "center",
  "ms": 150,
  "routes": {
    "left":   { "*": ["left"], "right": ["center", "left"] },
    "right":  { "*": ["right"], "left": ["center", "right"] },
    "center": { "*": ["center"], "ms": 80 }
  },
  "actions": {
    "go-left":  { "type": "sequence", "order": ["left"] },
    "go-right": { "type": "sequence", "order": ["right"] },
    "reset":    { "type": "sequence", "order": ["center"] },
    "patrol":   {
      "type": "loop",
      "order": ["left", "center", "right", "center"],
      "ms": 100,
      "count": 5
    }
  }
}
```

### JavaScript

```js
import VectorFlow from '@nitesh-tyagi/vectorflow';

// Load SVG (already in the DOM) and JSON config
const vf = new VectorFlow({
  svgElement: document.querySelector('#character-svg'),
  json: characterConfig,
});

// Wire up buttons
document.querySelector('#btn-left').onclick = () => vf.play('go-left');
document.querySelector('#btn-right').onclick = () => vf.play('go-right');
document.querySelector('#btn-reset').onclick = () => vf.play('reset');
document.querySelector('#btn-patrol').onclick = () => vf.play('patrol');
document.querySelector('#btn-stop').onclick = () => vf.stop();

// Listen for state changes
vf.on('stateChange', (state) => {
  document.querySelector('#current-state').textContent = state;
});

// Clean up when done
window.addEventListener('beforeunload', () => vf.destroy());
```

---

## Links

| Resource | URL |
|----------|-----|
| npm | [@nitesh-tyagi/vectorflow](https://www.npmjs.com/package/@nitesh-tyagi/vectorflow) |
| Live Demo | [vectorflow.webmuffin.io](https://vectorflow.webmuffin.io/) |
| Demo Source | [Nitesh-WebMuffin/SVG-Animator](https://github.com/Nitesh-WebMuffin/SVG-Animator) |
| Sample Files | [demo-files/](https://github.com/Nitesh-WebMuffin/SVG-Animator/tree/main/demo-files) |
| Docs | [docs/](https://github.com/Nitesh-WebMuffin/SVG-Animator/tree/main/docs) |

---

## License

MIT
