// The only script a rendered document loads (F05-T4): copy buttons on code blocks and, for browsers without
// invoker commands, the gallery dialogs' open and close. Delegated on the content's root, so it covers what the
// server rendered and what a client-side navigation renders later. Returns the cleanup
const COPIED_FOR_MS = 2000

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
    if (canCopy && button.hasAttribute('data-content-copy')) {
      void copy(button).catch(() => {})
    }
    else if (fallback && button.hasAttribute('commandfor')) {
      command(button)
    }
  }
  root.addEventListener('click', onClick)
  if (canCopy) {
    root.classList.add('content-can-copy')
  }
  return () => {
    root.removeEventListener('click', onClick)
    root.classList.remove('content-can-copy')
  }
}
