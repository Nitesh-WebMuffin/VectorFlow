# VectorFlow

A minimal, JSON-driven SVG pose animation library.

[![npm version](https://img.shields.io/npm/v/vectorflow.svg)](https://www.npmjs.com/package/vectorflow)
[![license](https://img.shields.io/npm/l/vectorflow.svg)](LICENSE)

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

## Quick Start

### Install

```bash
npm install vectorflow
```

### Browser (UMD)

```html
<script src="https://unpkg.com/vectorflow/dist/vectorflow.umd.js"></script>
<script>
  const vf = new VectorFlow({ svgElement: document.querySelector('svg'), json: config });
  vf.play('shuffle');
</script>
```

### ES Module

```js
import VectorFlow from 'vectorflow';

const vf = new VectorFlow({
  svgElement: document.querySelector('#my-svg'),
  json: configObject, // or JSON string
});

vf.play('left');       // play an action
vf.play('shuffle');    // auto-cancels previous, starts new
vf.stop();             // cancel current playback
```

---

## API

### Constructor

```js
const vf = new VectorFlow({ svgElement, json });
```

| Param | Type | Description |
|-------|------|-------------|
| `svgElement` | `SVGElement \| string` | An SVG DOM element or raw SVG string |
| `json` | `object \| string` | VectorFlow JSON config (object or string) |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `vf.states` | `string[]` | All discovered state names |
| `vf.currentState` | `string` | Current active state |
| `vf.actions` | `object` | Actions config from JSON |
| `vf.isPlaying` | `boolean` | Whether an action is currently playing |
| `vf.currentAction` | `string \| null` | Name of the playing action |
| `vf.svgElement` | `SVGElement` | The SVG element being animated |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `vf.play(actionName)` | `Promise<void>` | Play a named action. Auto-cancels any running action. |
| `vf.stop()` | `void` | Cancel current playback immediately. |
| `vf.on(event, callback)` | `VectorFlow` | Register an event listener. |
| `vf.off(event, callback)` | `VectorFlow` | Remove an event listener. |
| `vf.destroy()` | `void` | Clean up: stop playback, restore SVG, remove listeners. |

### Events

| Event | Callback Arg | Description |
|-------|-------------|-------------|
| `stateChange` | `string` | Fired after each step completes |
| `actionStart` | `string` | Fired when an action begins |
| `actionEnd` | `string` | Fired when an action finishes or is cancelled |
| `error` | `Error` | Fired on runtime errors |

---

## JSON Config Format

```json
{
  "name": "shape",
  "initial_state": "center",
  "ms": 120,
  "routes": {
    "left":   { "*": ["left"], "right": ["center", "left"] },
    "right":  { "*": ["right"], "left": ["center", "right"] },
    "center": { "*": ["center"], "ms": 60 }
  },
  "actions": {
    "left":    { "type": "sequence", "order": ["left"] },
    "right":   { "type": "sequence", "order": ["right"] },
    "center":  { "type": "sequence", "order": ["center"] },
    "shuffle": { "type": "loop", "mode": "direct", "order": ["left","center","right","center"], "ms": 80, "count": 99999 }
  }
}
```

**Duration precedence:** `action.ms` > `routes[target].ms` > `json.ms` > `120`

---

## SVG Structure

State groups use `id="state_{name}"`. Parts use `data-part="{name}"` directly on shape elements.

```xml
<svg viewBox="0 0 200 200">
  <g id="state_left">
    <rect data-part="shape" x="20" y="80" width="40" height="40" fill="red" />
  </g>
  <g id="state_center">
    <rect data-part="shape" x="80" y="80" width="40" height="40" fill="blue" />
  </g>
  <g id="state_right">
    <rect data-part="shape" x="140" y="80" width="40" height="40" fill="green" />
  </g>
</svg>
```

---

## License

MIT
