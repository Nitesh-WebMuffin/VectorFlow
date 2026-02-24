/**
 * VectorFlow — Utility helpers
 * Color parsing, attribute reading, interpolation helpers.
 */

/**
 * Parse a hex color string to { r, g, b } (0-255).
 * Supports #RGB, #RRGGBB.
 */
export function hexToRgb(hex) {
  if (!hex || hex === 'none') return null;
  hex = hex.trim().replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const num = parseInt(hex, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Convert { r, g, b } back to a hex string.
 */
export function rgbToHex({ r, g, b }) {
  const toHex = (n) => Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Linearly interpolate between two numbers.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Linearly interpolate between two colors (hex strings).
 * Returns a hex string.
 */
export function lerpColor(colorA, colorB, t) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  if (!a || !b) return colorB || colorA || '#000000';
  return rgbToHex({
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  });
}

/**
 * Numeric SVG attributes we want to interpolate.
 */
export const NUMERIC_ATTRS = ['x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'opacity'];

/**
 * Style properties that may contain colors.
 */
export const COLOR_PROPS = ['fill', 'stroke'];

/**
 * Read a numeric attribute from an SVG element.
 * Falls back to computed style, then to defaultVal.
 */
export function readNumericAttr(el, attr, defaultVal = 0) {
  // Try direct attribute first
  const raw = el.getAttribute(attr);
  if (raw !== null && raw !== '') {
    const val = parseFloat(raw);
    if (!isNaN(val)) return val;
  }
  return defaultVal;
}

/**
 * Read a color property from an SVG element.
 * Checks inline style first, then attribute, then computed style.
 * Returns a hex color string or null.
 */
export function readColorProp(el, prop) {
  // 1. Inline style
  const styleVal = el.style.getPropertyValue(prop);
  if (styleVal && styleVal !== 'none') {
    return normalizeColor(styleVal);
  }
  // 2. Direct attribute
  const attrVal = el.getAttribute(prop);
  if (attrVal && attrVal !== 'none') {
    return normalizeColor(attrVal);
  }
  // 3. Computed style
  const computed = window.getComputedStyle(el).getPropertyValue(prop);
  if (computed && computed !== 'none') {
    return normalizeColor(computed);
  }
  return null;
}

/**
 * Normalize a color value to hex. Handles:
 * - hex: #fff, #ff0000
 * - rgb(...): rgb(255, 0, 0)
 */
export function normalizeColor(val) {
  if (!val || val === 'none') return null;
  val = val.trim();

  // Already hex
  if (val.startsWith('#')) return val;

  // rgb(r, g, b) or rgb(r,g,b)
  const match = val.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (match) {
    return rgbToHex({
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
    });
  }

  // Named colors — use a canvas trick
  if (typeof document !== 'undefined') {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = val;
    const resolved = ctx.fillStyle; // returns hex
    if (resolved.startsWith('#')) return resolved;
  }

  return val;
}

/**
 * Read all animatable snapshot from an SVG element.
 * Returns { numericAttrs: {attr: value}, colors: {prop: hexString}, transform: string|null }
 */
export function readSnapshot(el) {
  const snapshot = {
    numericAttrs: {},
    colors: {},
    transform: null,
  };

  // Numeric attributes
  for (const attr of NUMERIC_ATTRS) {
    const raw = el.getAttribute(attr);
    if (raw !== null && raw !== '') {
      const val = parseFloat(raw);
      if (!isNaN(val)) {
        snapshot.numericAttrs[attr] = val;
      }
    }
  }

  // Colors
  for (const prop of COLOR_PROPS) {
    const color = readColorProp(el, prop);
    if (color) {
      snapshot.colors[prop] = color;
    }
  }

  // Transform
  const transform = el.getAttribute('transform');
  if (transform) {
    snapshot.transform = transform;
  }

  return snapshot;
}

/**
 * Parse a simple SVG transform string into components.
 * Only handles translate, scale, rotate as simple cases.
 * Returns an object like { translateX, translateY, scaleX, scaleY, rotate }.
 */
export function parseTransform(transformStr) {
  const result = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotate: 0 };
  if (!transformStr) return result;

  const translateMatch = transformStr.match(/translate\(\s*([-\d.]+)\s*[,\s]\s*([-\d.]+)\s*\)/);
  if (translateMatch) {
    result.translateX = parseFloat(translateMatch[1]);
    result.translateY = parseFloat(translateMatch[2]);
  }

  const scaleMatch = transformStr.match(/scale\(\s*([-\d.]+)(?:\s*[,\s]\s*([-\d.]+))?\s*\)/);
  if (scaleMatch) {
    result.scaleX = parseFloat(scaleMatch[1]);
    result.scaleY = scaleMatch[2] !== undefined ? parseFloat(scaleMatch[2]) : result.scaleX;
  }

  const rotateMatch = transformStr.match(/rotate\(\s*([-\d.]+)/);
  if (rotateMatch) {
    result.rotate = parseFloat(rotateMatch[1]);
  }

  return result;
}

/**
 * Build a transform string from parsed components.
 */
export function buildTransform({ translateX, translateY, scaleX, scaleY, rotate }) {
  const parts = [];
  if (translateX !== 0 || translateY !== 0) {
    parts.push(`translate(${translateX},${translateY})`);
  }
  if (rotate !== 0) {
    parts.push(`rotate(${rotate})`);
  }
  if (scaleX !== 1 || scaleY !== 1) {
    parts.push(`scale(${scaleX},${scaleY})`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}
