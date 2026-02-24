/**
 * VectorFlow — Player
 * Animation playback using anime.js, with cancel/interrupt support.
 */

import anime from 'animejs/lib/anime.es.js';
import { readSnapshot, lerpColor, parseTransform, buildTransform, lerp } from './utils.js';

/**
 * Animate a single step: transition all live parts to target state.
 * Returns a Promise that resolves when the animation completes.
 *
 * @param {Map<string, Element>} liveParts — partName → live element
 * @param {Map<string, object>} targetSnapshots — partName → snapshot for target state
 * @param {number} ms — animation duration
 * @param {AbortSignal} signal — for cancellation
 * @returns {Promise<void>}
 */
export function playStep(liveParts, targetSnapshots, ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const animations = [];
    let completedCount = 0;
    const totalParts = liveParts.size;

    if (totalParts === 0) {
      resolve();
      return;
    }

    for (const [partName, liveEl] of liveParts) {
      const targetSnap = targetSnapshots.get(partName);
      if (!targetSnap) continue;

      // Read current snapshot from the live element
      const currentSnap = readSnapshot(liveEl);

      // Build anime.js animation targets
      const animeConfig = {
        targets: liveEl,
        duration: ms,
        easing: 'linear',
        complete: () => {
          completedCount++;
          if (completedCount >= totalParts) {
            resolve();
          }
        },
      };

      // Animate numeric attributes
      for (const [attr, targetVal] of Object.entries(targetSnap.numericAttrs)) {
        const currentVal = currentSnap.numericAttrs[attr] ?? targetVal;
        if (currentVal !== targetVal) {
          animeConfig[attr] = targetVal;
        }
      }

      // Animate colors using update callback
      const colorAnimations = [];
      for (const [prop, targetColor] of Object.entries(targetSnap.colors)) {
        const currentColor = currentSnap.colors[prop];
        if (currentColor && currentColor !== targetColor) {
          colorAnimations.push({ prop, from: currentColor, to: targetColor });
        } else if (!currentColor && targetColor) {
          // Set directly if no current
          liveEl.style.setProperty(prop, targetColor);
        }
      }

      // Animate transform
      let transformAnim = null;
      if (targetSnap.transform || currentSnap.transform) {
        const fromT = parseTransform(currentSnap.transform);
        const toT = parseTransform(targetSnap.transform);
        if (JSON.stringify(fromT) !== JSON.stringify(toT)) {
          transformAnim = { from: fromT, to: toT };
        }
      }

      // If we have color or transform animations, use the update callback
      if (colorAnimations.length > 0 || transformAnim) {
        const progressObj = { t: 0 };
        const colorTransformAnim = anime({
          targets: progressObj,
          t: 1,
          duration: ms,
          easing: 'linear',
          update: () => {
            const t = progressObj.t;
            // Colors
            for (const { prop, from, to } of colorAnimations) {
              const interpolated = lerpColor(from, to, t);
              liveEl.style.setProperty(prop, interpolated);
            }
            // Transform
            if (transformAnim) {
              const { from, to } = transformAnim;
              const interpolated = {
                translateX: lerp(from.translateX, to.translateX, t),
                translateY: lerp(from.translateY, to.translateY, t),
                scaleX: lerp(from.scaleX, to.scaleX, t),
                scaleY: lerp(from.scaleY, to.scaleY, t),
                rotate: lerp(from.rotate, to.rotate, t),
              };
              const transformStr = buildTransform(interpolated);
              if (transformStr) {
                liveEl.setAttribute('transform', transformStr);
              } else {
                liveEl.removeAttribute('transform');
              }
            }
          },
        });
        animations.push(colorTransformAnim);
      }

      // Create the main numeric attributes animation
      const hasNumericChanges = Object.keys(animeConfig).some(
        k => !['targets', 'duration', 'easing', 'complete'].includes(k)
      );

      if (hasNumericChanges) {
        const anim = anime(animeConfig);
        animations.push(anim);
      } else {
        // If no numeric changes, still count this part as complete
        animeConfig.complete();
      }
    }

    // Handle abort
    const onAbort = () => {
      for (const anim of animations) {
        anime.remove(anim.targets || anim);
        if (anim.pause) anim.pause();
      }
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Play a sequence of steps.
 *
 * @param {Array<{state: string, ms: number}>} steps
 * @param {Map<string, Element>} liveParts
 * @param {Map<string, Map<string, object>>} stateSnapshots — stateName → partName → snapshot
 * @param {AbortSignal} signal
 * @param {function(string)} onStateChange — callback when a step completes
 * @returns {Promise<string>} — resolves with the final state
 */
export async function playSteps(steps, liveParts, stateSnapshots, signal, onStateChange) {
  let lastState = null;

  for (const step of steps) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const targetSnapshots = stateSnapshots.get(step.state);
    if (!targetSnapshots) {
      throw new Error(`VectorFlow: No snapshots for state "${step.state}"`);
    }

    await playStep(liveParts, targetSnapshots, step.ms, signal);
    lastState = step.state;

    if (onStateChange) {
      onStateChange(step.state);
    }
  }

  return lastState;
}

/**
 * Run a full action (sequence or loop).
 *
 * @param {object} action — normalized action object
 * @param {string} currentState
 * @param {object} routes
 * @param {number} jsonMs
 * @param {Set<string>} validStates
 * @param {Map<string, Element>} liveParts
 * @param {Map<string, Map<string, object>>} stateSnapshots
 * @param {AbortSignal} signal
 * @param {function(string)} onStateChange
 * @param {object} expandFns — { expandSequence, expandDirect } from engine
 * @returns {Promise<string>} — final state
 */
export async function runAction(
  action, currentState, routes, jsonMs, validStates,
  liveParts, stateSnapshots, signal, onStateChange, expandFns
) {
  const { expandSequence, expandDirect } = expandFns;

  if (action.type === 'loop') {
    const count = action.count || 99999;
    let current = currentState;

    for (let i = 0; i < count; i++) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      let result;
      if (action.mode === 'direct') {
        result = expandDirect(action.order, current, routes, action.ms, jsonMs, validStates);
      } else {
        result = expandSequence(action.order, current, routes, action.ms, jsonMs, validStates);
      }

      if (result.steps.length > 0) {
        const finalState = await playSteps(
          result.steps, liveParts, stateSnapshots, signal, onStateChange
        );
        current = finalState || current;
      }
    }

    return current;
  } else {
    // sequence (default)
    const result = expandSequence(
      action.order, currentState, routes, action.ms, jsonMs, validStates
    );

    if (result.steps.length > 0) {
      const finalState = await playSteps(
        result.steps, liveParts, stateSnapshots, signal, onStateChange
      );
      return finalState || currentState;
    }

    return currentState;
  }
}
