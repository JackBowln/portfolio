// The only script a rendered document loads (F05-T4): copy buttons on code blocks, the embed facades' players
// (F05-T5) and, for browsers without invoker commands, the gallery dialogs' open and close. Delegated on the
// content's root, so it covers what the server rendered and what a client-side navigation renders later.
// Returns the cleanup
import { isEmbedFrameUrl } from '#shared/content/embed-origins'

const COPIED_FOR_MS = 2000
// What the players need and nothing more (ADR-0012 §1): their own scripts and storage, fullscreen, and opening the
// video on the provider's site
const PLAYER_SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups'
const PLAYER_ALLOW = 'autoplay; encrypted-media; picture-in-picture; fullscreen'

const supportsCommands = () => typeof HTMLButtonElement !== 'undefined' && 'command' in HTMLButtonElement.prototype

async function copy(button: HTMLButtonElement): Promise<void> {
  const figure = button.closest('figure')
  const code = figure?.querySelector('code')?.textContent
  if (!figure || code === undefined || code === null) {
    return
  }
  await navigator.clipboard.writeText(code)
  const status = figure.querySelector('[data-content-copy-status]')
  const label = button.textContent
  button.textContent = button.dataset.copied ?? label
  if (status) {
    status.textContent = button.dataset.copied ?? ''
  }
  setTimeout(() => {
    button.textContent = label
    if (status) {
      status.textContent = ''
    }
  }, COPIED_FOR_MS)
}

/** The click is the reader's consent: only now is anything requested from the provider */
function play(button: HTMLButtonElement): void {
  const frame = button.closest<HTMLElement>('[data-content-embed]')
  const src = frame?.dataset.player ?? ''
  if (!frame || !isEmbedFrameUrl(src)) {
    return
  }
  const iframe = document.createElement('iframe')
  iframe.src = src
  iframe.title = frame.dataset.title ?? ''
  iframe.setAttribute('sandbox', PLAYER_SANDBOX)
  iframe.setAttribute('allow', PLAYER_ALLOW)
  iframe.setAttribute('allowfullscreen', '')
  // The players refuse to play without a referrer; the origin is all they get
  iframe.referrerPolicy = 'strict-origin-when-cross-origin'
  frame.replaceChildren(iframe)
  iframe.focus()
}

function command(button: HTMLButtonElement): void {
  const dialog = document.getElementById(button.getAttribute('commandfor') ?? '')
  if (!(dialog instanceof HTMLDialogElement)) {
    return
  }
  if (button.getAttribute('command') === 'show-modal' && !dialog.open) {
    dialog.showModal()
  }
  else if (button.getAttribute('command') === 'close') {
    dialog.close()
  }
}

export function enhanceContent(root: HTMLElement): () => void {
  const canCopy = typeof navigator !== 'undefined' && navigator.clipboard !== undefined && window.isSecureContext
  const fallback = !supportsCommands()
  const onClick = (event: MouseEvent) => {
    const button = (event.target as Element | null)?.closest('button')
    if (!button || !root.contains(button)) {
      return
    }
    if (button.hasAttribute('data-content-play')) {
      play(button)
    }
    else if (canCopy && button.hasAttribute('data-content-copy')) {
      void copy(button).catch(() => {})
    }
    else if (fallback && button.hasAttribute('commandfor')) {
      command(button)
    }
  }
  root.addEventListener('click', onClick)
  root.classList.add('content-can-play')
  if (canCopy) {
    root.classList.add('content-can-copy')
  }
  return () => {
    root.removeEventListener('click', onClick)
    root.classList.remove('content-can-copy', 'content-can-play')
  }
}
