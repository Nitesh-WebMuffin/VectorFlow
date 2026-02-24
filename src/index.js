/**
 * VectorFlow — Main entry point
 * Public API: VectorFlow class.
 */

import {
  parseAndValidateJSON,
  discoverStates,
  discoverParts,
  setupLiveCharacter,
  buildStateSnapshots,
} from './parser.js';

import {
  expandSequence,
  expandDirect,
} from './engine.js';

import { runAction } from './player.js';

/**
 * VectorFlow — A JSON-driven SVG pose animation runner.
 *
 * Usage:
 *   const vf = new VectorFlow({ svgElement, json });
 *   vf.play('shuffle');
 *   vf.stop();
 *   vf.on('stateChange', (state) => console.log(state));
 */
class VectorFlow {
  /**
   * @param {object} options
   * @param {SVGElement|string} options.svgElement — An SVG DOM element or an SVG string
   * @param {object|string} options.json — A VectorFlow JSON config (object or string)
   */
  constructor({ svgElement, json }) {
    // Event listeners
    this._listeners = {
      stateChange: [],
      actionStart: [],
      actionEnd: [],
      error: [],
    };

    // Current abort controller for cancellation
    this._abortController = null;
    this._currentActionName = null;

    // Parse JSON
    this._config = parseAndValidateJSON(json);

    // Resolve SVG element
    if (typeof svgElement === 'string') {
      const container = document.createElement('div');
      container.innerHTML = svgElement.trim();
      this._svgElement = container.querySelector('svg');
      if (!this._svgElement) {
        throw new Error('VectorFlow: Provided SVG string does not contain an <svg> element.');
      }
    } else if (svgElement instanceof SVGElement) {
      this._svgElement = svgElement;
    } else {
      throw new Error('VectorFlow: svgElement must be an SVG DOM element or an SVG string.');
    }

    // Discover states and parts
    this._stateMap = discoverStates(this._svgElement);
    this._stateParts = discoverParts(this._stateMap);
    this._validStates = new Set(this._stateMap.keys());

    // Validate initial_state exists
    if (!this._validStates.has(this._config.initial_state)) {
      const available = Array.from(this._validStates).join(', ');
      throw new Error(
        `VectorFlow: initial_state "${this._config.initial_state}" not found in SVG. Available states: ${available}`
      );
    }

    // Build snapshots from original state groups (before hiding)
    this._stateSnapshots = buildStateSnapshots(this._stateParts);

    // Set up live character
    const { liveGroup, liveParts } = setupLiveCharacter(
      this._svgElement, this._stateMap, this._config.initial_state
    );
    this._liveGroup = liveGroup;
    this._liveParts = liveParts;

    // Track current state
    this._currentState = this._config.initial_state;
  }

  // ---- Public API: Properties ----

  /** Get all discovered state names. */
  get states() {
    return Array.from(this._validStates);
  }

  /** Get the current state name. */
  get currentState() {
    return this._currentState;
  }

  /** Get the actions config object. */
  get actions() {
    return { ...this._config.actions };
  }

  /** Get the SVG element being animated. */
  get svgElement() {
    return this._svgElement;
  }

  /** Whether an action is currently playing. */
  get isPlaying() {
    return this._abortController !== null && !this._abortController.signal.aborted;
  }

  /** Name of the currently playing action (null if none). */
  get currentAction() {
    return this._currentActionName;
  }

  // ---- Public API: Methods ----

  /**
   * Play a named action. Cancels any currently playing action.
   * @param {string} actionName
   * @returns {Promise<void>}
   */
  async play(actionName) {
    const action = this._config.actions[actionName];
    if (!action) {
      const err = new Error(`VectorFlow: Unknown action "${actionName}"`);
      this._emit('error', err);
      throw err;
    }

    if (action.order.length === 0) {
      console.warn(`VectorFlow: Action "${actionName}" has empty order — no-op.`);
      return;
    }

    // Cancel any running action
    this.stop();

    // New abort controller
    this._abortController = new AbortController();
    this._currentActionName = actionName;
    this._emit('actionStart', actionName);

    try {
      const finalState = await runAction(
        action,
        this._currentState,
        this._config.routes,
        this._config.ms,
        this._validStates,
        this._liveParts,
        this._stateSnapshots,
        this._abortController.signal,
        (state) => {
          this._currentState = state;
          this._emit('stateChange', state);
        },
        { expandSequence, expandDirect }
      );

      if (finalState) {
        this._currentState = finalState;
      }

      this._currentActionName = null;
      this._emit('actionEnd', actionName);
    } catch (err) {
      if (err.name === 'AbortError') {
        // Cancelled — not an error
        return;
      }
      this._currentActionName = null;
      this._emit('error', err);
      throw err;
    }
  }

  /**
   * Stop/cancel any currently playing action.
   */
  stop() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
      if (this._currentActionName) {
        const name = this._currentActionName;
        this._currentActionName = null;
        this._emit('actionEnd', name);
      }
    }
  }

  /**
   * Register an event listener.
   * @param {'stateChange'|'actionStart'|'actionEnd'|'error'} event
   * @param {function} callback
   */
  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
    return this;
  }

  /**
   * Remove an event listener.
   * @param {string} event
   * @param {function} callback
   */
  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }
    return this;
  }

  /**
   * Clean up: stop playback, restore SVG state groups, remove live character.
   */
  destroy() {
    this.stop();

    // Show original state groups again
    if (this._stateMap) {
      for (const [, groupEl] of this._stateMap) {
        groupEl.style.display = '';
      }
    }

    // Remove live group
    if (this._liveGroup && this._liveGroup.parentNode) {
      this._liveGroup.remove();
    }

    this._listeners = { stateChange: [], actionStart: [], actionEnd: [], error: [] };
  }

  // ---- Private ----

  _emit(event, data) {
    if (this._listeners[event]) {
      for (const cb of this._listeners[event]) {
        try {
          cb(data);
        } catch (e) {
          console.error(`VectorFlow: Error in "${event}" listener:`, e);
        }
      }
    }
  }
}

export default VectorFlow;
export { VectorFlow };
