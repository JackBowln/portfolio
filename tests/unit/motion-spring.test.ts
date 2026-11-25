// F13-T6: the pointer spring settles on its target with a small overshoot, a long frame cannot make it diverge, and
// it rests exactly where it began when there is nothing to move
import { describe, expect, it } from 'vitest'
import { AT_REST, POINTER_SPRING, isAtRest, stepSpring } from '../../app/composables/motion/spring'

// Runs the spring at 60 fps for `seconds`, returning the positions it passed through
function run(target: number, seconds: number, from = AT_REST) {
  let state = from
  const positions: number[] = []
  for (let frame = 0; frame < seconds * 60; frame++) {
    state = stepSpring(state, target, 1 / 60)
    positions.push(state.position)
  }
  return { state, positions }
}

describe('pointer spring', () => {
  it('settles on the target within about a second', () => {
    const { state } = run(6, 1.5)
    expect(state.position).toBeCloseTo(6, 1)
    expect(isAtRest(state, 6)).toBe(true)
  })

  it('overshoots by a small share of the distance, near critical damping', () => {
    const { positions } = run(6, 2)
    const peak = Math.max(...positions)
    expect(peak).toBeGreaterThan(6)
    expect(peak - 6).toBeLessThan(6 * 0.1)
  })

  it('does not diverge after a long frame gap', () => {
    const next = stepSpring(AT_REST, 6, 5)
    expect(Number.isFinite(next.position)).toBe(true)
    expect(Math.abs(next.position)).toBeLessThan(20)
  })

  it('stays put at rest, and a negative step counts as no time', () => {
    expect(stepSpring(AT_REST, 0, 1 / 60)).toEqual(AT_REST)
    expect(stepSpring({ position: 2, velocity: 1 }, 0, -1)).toEqual({ position: 2, velocity: 1 })
  })

  it('uses the pointer config by default', () => {
    expect(stepSpring(AT_REST, 6, 1 / 60)).toEqual(stepSpring(AT_REST, 6, 1 / 60, POINTER_SPRING))
  })
})
