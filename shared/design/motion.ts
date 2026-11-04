// Motion preference and progressive enhancement (ADR-0011 §3–4, storyboard-home §1). Movement is allowed only with
// JS, without `prefers-reduced-motion: reduce` and without the site's "Reduce motion" button (kept in localStorage,
// never a cookie). Hidden starting states exist only under html.motion-ok, which the inline script below sets; if no
// motion starts within 3 s, the class goes and everything shows as it is
export const MOTION_STORAGE_KEY = 'reduce-motion'
export const MOTION_OK_CLASS = 'motion-ok'
/** Set on <html> by useMotion once an animation starts; cancels the fallback */
export const MOTION_STARTED = 'started'
export const MOTION_FALLBACK_MS = 3000
/** Dispatched on window when the visitor turns motion off: running animations revert */
export const MOTION_REDUCE_EVENT = 'motion:reduce'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Inline in <head> before the first paint, allowed in the CSP by hash (server/plugins/csp.ts hashes every inline
 * script). Marks the stored choice (data-reduce-motion, which also turns view transitions off) and, when motion is
 * allowed, adds the class with its 3 s fallback. Storage may throw (privacy modes): motion then stays off
 */
export const MOTION_INIT_SCRIPT = `try{var d=document.documentElement;if(localStorage.getItem(${JSON.stringify(MOTION_STORAGE_KEY)})==="1"){d.dataset.reduceMotion="1"}else if(!matchMedia(${JSON.stringify(REDUCED_MOTION_QUERY)}).matches){d.classList.add(${JSON.stringify(MOTION_OK_CLASS)});setTimeout(function(){if(d.dataset.motion!==${JSON.stringify(MOTION_STARTED)})d.classList.remove(${JSON.stringify(MOTION_OK_CLASS)})},${MOTION_FALLBACK_MS})}}catch(e){}`
