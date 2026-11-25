// A second-order spring for pointer-driven motion (F13-T6, animation-mapping M-02). The state is one number and its
// velocity; each step moves it toward the target with a stiffness and a damping, so a small pointer offset settles
// with a little weight instead of a fixed easing curve. Pure functions: no DOM, no GSAP, so the maths is unit-tested.
// The damping is near critical (ζ ≈ 0.7): it reaches the target with a small overshoot and settles in about half a second

export interface Spring {
  position: number
  velocity: number
}

export interface SpringConfig {
  /** Pull toward the target, per second squared */
  stiffness: number
  /** Resistance to velocity, per second */
  damping: number
}

/** The config of the pointer response: ω ≈ 16.7 rad/s, ζ ≈ 0.7 */
export const POINTER_SPRING: SpringConfig = { stiffness: 280, damping: 23.3 }

export const AT_REST: Spring = { position: 0, velocity: 0 }

/** The longest step taken at once: a tab in the background returns with a big delta, which must not blow the spring up */
const MAX_STEP_SECONDS = 1 / 30

/** One semi-implicit Euler step over `seconds` toward `target`; stable for the pointer config at 30 fps and above */
export function stepSpring(state: Spring, target: number, seconds: number, config: SpringConfig = POINTER_SPRING): Spring {
  const step = Math.min(Math.max(seconds, 0), MAX_STEP_SECONDS)
  const acceleration = config.stiffness * (target - state.position) - config.damping * state.velocity
  const velocity = state.velocity + acceleration * step
  return { position: state.position + velocity * step, velocity }
}

/** True once the spring has come to rest on its target, within `epsilon` pixels */
export function isAtRest(state: Spring, target: number, epsilon = 0.01): boolean {
  return Math.abs(state.position - target) < epsilon && Math.abs(state.velocity) < epsilon
}
