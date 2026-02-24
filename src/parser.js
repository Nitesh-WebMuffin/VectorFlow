/**
 * VectorFlow — Parser
 * JSON validation/normalization + SVG state/part discovery.
 */

import { readSnapshot } from './utils.js';

/**
 * Parse and validate a VectorFlow JSON config.
 * Returns a normalized config object.
 * Throws on invalid input.
 */
export function parseAndValidateJSON(input) {
  let json;
  if (typeof input === 'string') {
    try {
      json = JSON.parse(input);
    } catch (e) {
      throw new Error(`VectorFlow: Invalid JSON — ${e.message}`);
    }
  } else if (typeof input === 'object' && input !== null) {
    json = input;
  } else {
    throw new Error('VectorFlow: JSON input must be a string or object');
  }

  // Validate required fields
  if (!json.initial_state || typeof json.initial_state !== 'string') {
    throw new Error('VectorFlow: JSON must have a string "initial_state" field');
  }
  if (!json.routes || typeof json.routes !== 'object') {
    throw new Error('VectorFlow: JSON must have a "routes" object');
  }
  if (!json.actions || typeof json.actions !== 'object') {
    throw new Error('VectorFlow: JSON must have an "actions" object');
  }

  // Normalize top-level ms
  const globalMs = (typeof json.ms === 'number' && json.ms > 0) ? json.ms : 120;

  // Validate routes
  const routes = {};
  for (const [target, block] of Object.entries(json.routes)) {
    if (typeof block !== 'object' || block === null) {
      throw new Error(`VectorFlow: routes["${target}"] must be an object`);
    }
    routes[target] = {};
    for (const [key, value] of Object.entries(block)) {
      if (key === 'ms') {
        if (typeof value !== 'number') {
          throw new Error(`VectorFlow: routes["${target}"].ms must be a number`);
        }
        routes[target].ms = value;
      } else {
        if (!Array.isArray(value) || !value.every(s => typeof s === 'string')) {
          throw new Error(`VectorFlow: routes["${target}"]["${key}"] must be an array of strings`);
        }
        routes[target][key] = value;
      }
    }
  }

  // Normalize actions
  const actions = {};
  for (const [name, action] of Object.entries(json.actions)) {
    const type = (action.type === 'loop') ? 'loop' : 'sequence';

    if (!Array.isArray(action.order) || action.order.length === 0) {
      console.warn(`VectorFlow: action "${name}" has no valid order — will be a no-op`);
      actions[name] = { type, order: [], ms: undefined, count: undefined, mode: undefined };
      continue;
    }

    const ms = (typeof action.ms === 'number' && action.ms > 0) ? action.ms : undefined;
    let count;
    let mode;

    if (type === 'loop') {
      count = (typeof action.count === 'number' && action.count > 0) ? action.count : 99999;
      mode = (typeof action.mode === 'string') ? action.mode : undefined;
    }

    actions[name] = { type, order: action.order, ms, count, mode };
  }

  return {
    name: json.name || 'untitled',
    initial_state: json.initial_state,
    ms: globalMs,
    routes,
    actions,
  };
}

/**
 * Discover state groups from an SVG element.
 * Returns a Map: stateName → SVG <g> element.
 * Throws if no state groups found.
 */
export function discoverStates(svgElement) {
  const stateGroups = svgElement.querySelectorAll('g[id^="state_"]');
  if (stateGroups.length === 0) {
    throw new Error('VectorFlow: No state groups found in SVG. Expected groups with id="state_{name}".');
  }

  const stateMap = new Map();
  for (const g of stateGroups) {
    const stateName = g.id.replace(/^state_/, '');
    if (stateName) {
      stateMap.set(stateName, g);
    }
  }

  if (stateMap.size === 0) {
    throw new Error('VectorFlow: No valid state groups found in SVG.');
  }

  return stateMap;
}

/**
 * Discover parts from all state groups.
 * Returns a Map: stateName → Map(partName → element).
 * Validates that all states have identical part sets.
 */
export function discoverParts(stateMap) {
  const stateParts = new Map();
  let referencePartNames = null;
  let referenceStateName = null;

  for (const [stateName, groupEl] of stateMap) {
    const parts = new Map();
    const partEls = groupEl.querySelectorAll('[data-part]');

    for (const el of partEls) {
      const partName = el.getAttribute('data-part');
      if (partName) {
        parts.set(partName, el);
      }
    }

    if (parts.size === 0) {
      throw new Error(`VectorFlow: State "${stateName}" has no parts (elements with data-part attribute).`);
    }

    // Validate matching part sets
    const currentPartNames = Array.from(parts.keys()).sort().join(',');
    if (referencePartNames === null) {
      referencePartNames = currentPartNames;
      referenceStateName = stateName;
    } else if (currentPartNames !== referencePartNames) {
      throw new Error(
        `VectorFlow: Part mismatch between states. ` +
        `State "${referenceStateName}" has parts [${referencePartNames}] ` +
        `but state "${stateName}" has parts [${currentPartNames}].`
      );
    }

    stateParts.set(stateName, parts);
  }

  return stateParts;
}

/**
 * Set up the live character group.
 * Clones the initial state, inserts into SVG, hides original state groups.
 * Returns { liveGroup: element, liveParts: Map(partName → element) }.
 */
export function setupLiveCharacter(svgElement, stateMap, initialState) {
  const initialGroup = stateMap.get(initialState);
  if (!initialGroup) {
    const available = Array.from(stateMap.keys()).join(', ');
    throw new Error(
      `VectorFlow: initial_state "${initialState}" not found in SVG. Available states: ${available}`
    );
  }

  // Remove any existing live group
  const existingLive = svgElement.querySelector('#live_character');
  if (existingLive) {
    existingLive.remove();
  }

  // Clone initial state
  const liveGroup = initialGroup.cloneNode(true);
  liveGroup.id = 'live_character';
  liveGroup.removeAttribute('style');
  liveGroup.style.display = '';

  // Insert live group into SVG
  svgElement.appendChild(liveGroup);

  // Hide all original state groups
  for (const [, groupEl] of stateMap) {
    groupEl.style.display = 'none';
  }

  // Build live parts map
  const liveParts = new Map();
  const partEls = liveGroup.querySelectorAll('[data-part]');
  for (const el of partEls) {
    const partName = el.getAttribute('data-part');
    if (partName) {
      liveParts.set(partName, el);
    }
  }

  return { liveGroup, liveParts };
}

/**
 * Build snapshots for all states and parts.
 * Returns Map: stateName → Map(partName → snapshot).
 */
export function buildStateSnapshots(stateParts) {
  const snapshots = new Map();
  for (const [stateName, parts] of stateParts) {
    const partSnapshots = new Map();
    for (const [partName, el] of parts) {
      partSnapshots.set(partName, readSnapshot(el));
    }
    snapshots.set(stateName, partSnapshots);
  }
  return snapshots;
}
