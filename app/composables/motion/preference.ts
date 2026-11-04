// The motion preference in the browser (ADR-0011 §3): the system's reduced motion or the site's button. Read where
// a decision is made, never cached, so a change applies to the next animation
import { MOTION_STORAGE_KEY, REDUCED_MOTION_QUERY } from '#shared/design/motion'

export function systemReducesMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION_QUERY).matches
}

export function storedReducesMotion(): boolean {
  try {
    return localStorage.getItem(MOTION_STORAGE_KEY) === '1'
  }
  catch {
    // Without storage the choice cannot be kept; motion stays off, the safe side
    return true
  }
}

export function motionAllowed(): boolean {
  return !systemReducesMotion() && !storedReducesMotion()
}
