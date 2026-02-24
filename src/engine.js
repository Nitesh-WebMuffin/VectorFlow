/**
 * VectorFlow — Engine
 * Route resolution, ms precedence, step expansion.
 */

/**
 * Resolve the path from currentState to targetState using routes.
 * Returns an array of state names to visit.
 *
 * @param {string} targetState
 * @param {string} currentState
 * @param {object} routes — normalized routes object
 * @returns {string[]}
 */
export function resolvePath(targetState, currentState, routes) {
  const routeBlock = routes[targetState];
  if (!routeBlock) {
    return [targetState]; // fallback: direct
  }

  // Try specific path for current state
  if (Array.isArray(routeBlock[currentState])) {
    return routeBlock[currentState];
  }

  // Try wildcard
  if (Array.isArray(routeBlock['*'])) {
    return routeBlock['*'];
  }

  // Fallback: direct
  return [targetState];
}

/**
 * Normalize a path by removing a leading state that matches currentState
 * to avoid a no-op step.
 *
 * @param {string[]} path
 * @param {string} currentState
 * @returns {string[]}
 */
export function normalizePath(path, currentState) {
  if (path.length > 0 && path[0] === currentState) {
    return path.slice(1);
  }
  return path;
}

/**
 * Resolve the ms for a step using the precedence chain:
 * action.ms > routes[target].ms > json.ms > 120
 *
 * @param {number|undefined} actionMs
 * @param {number|undefined} routeMs — routes[targetState].ms
 * @param {number} jsonMs
 * @returns {number}
 */
export function resolveMs(actionMs, routeMs, jsonMs) {
  if (typeof actionMs === 'number' && actionMs > 0) return actionMs;
  if (typeof routeMs === 'number' && routeMs > 0) return routeMs;
  if (typeof jsonMs === 'number' && jsonMs > 0) return jsonMs;
  return 120;
}

/**
 * Expand a sequence action into a list of normalized steps.
 *
 * @param {string[]} order — target states to visit
 * @param {string} currentState
 * @param {object} routes
 * @param {number|undefined} actionMs
 * @param {number} jsonMs
 * @param {Set<string>} validStates — set of known state names
 * @returns {{ steps: Array<{state: string, ms: number}>, finalState: string }}
 */
export function expandSequence(order, currentState, routes, actionMs, jsonMs, validStates) {
  const steps = [];
  let current = currentState;

  for (const targetState of order) {
    // Validate state exists
    if (validStates && !validStates.has(targetState)) {
      throw new Error(`VectorFlow: State not found in SVG: "${targetState}"`);
    }

    const path = normalizePath(resolvePath(targetState, current, routes), current);

    for (const nextState of path) {
      if (validStates && !validStates.has(nextState)) {
        throw new Error(`VectorFlow: State not found in SVG: "${nextState}"`);
      }

      const routeMs = routes[nextState]?.ms;
      const ms = resolveMs(actionMs, routeMs, jsonMs);
      steps.push({ state: nextState, ms });
      current = nextState;
    }
  }

  return { steps, finalState: current };
}

/**
 * Expand a direct-mode action into steps (skip route resolution).
 *
 * @param {string[]} order
 * @param {string} currentState
 * @param {object} routes — still needed for ms lookup
 * @param {number|undefined} actionMs
 * @param {number} jsonMs
 * @param {Set<string>} validStates
 * @returns {{ steps: Array<{state: string, ms: number}>, finalState: string }}
 */
export function expandDirect(order, currentState, routes, actionMs, jsonMs, validStates) {
  const steps = [];
  let current = currentState;

  for (const targetState of order) {
    if (validStates && !validStates.has(targetState)) {
      throw new Error(`VectorFlow: State not found in SVG: "${targetState}"`);
    }

    // In direct mode, skip if already at target
    if (targetState === current) continue;

    const routeMs = routes[targetState]?.ms;
    const ms = resolveMs(actionMs, routeMs, jsonMs);
    steps.push({ state: targetState, ms });
    current = targetState;
  }

  return { steps, finalState: current };
}
