<script setup lang="ts">
// Mobile navigation as a modal <dialog> (WAI-ARIA APG dialog): showModal makes the rest of the page inert, so focus
// stays inside; Esc closes it and the browser returns focus to the menu button. The `command` attributes open and
// close it before hydration too; the click handlers cover browsers without invoker commands
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const open = ref(false)
const route = useRoute()

function show() {
  if (!dialog.value?.open) {
    dialog.value?.showModal()
  }
  open.value = true
}

function close() {
  dialog.value?.close()
}

// A modal dialog lets Tab leave for the browser UI after its last control; APG wraps it to the first one instead
function wrapFocus(event: KeyboardEvent) {
  const controls = [...(dialog.value?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [])]
  const first = controls[0]
  const last = controls.at(-1)
  if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
    event.preventDefault()
    const target = event.shiftKey ? last : first
    target?.focus()
  }
}

// Following a link swaps the page behind the dialog, so it closes
watch(() => route.fullPath, close)
</script>

<template>
  <div>
    <button
      type="button"
      class="inline-flex min-h-(--target-comfortable) cursor-pointer items-center gap-2 border border-border px-3 font-mono text-step--1 uppercase tracking-label"
      aria-haspopup="dialog"
      :aria-expanded="open"
      aria-controls="site-menu"
      commandfor="site-menu"
      command="show-modal"
      @click="show"
    >
      <UiIcon name="menu" />
      {{ $t('layout.menu.open') }}
    </button>
    <dialog
      id="site-menu"
      ref="dialog"
      class="site-menu m-0 h-dvh max-h-none w-full max-w-none bg-bg text-text backdrop:bg-bg"
      :aria-label="$t('layout.menu.label')"
      closedby="any"
      @close="open = false"
      @keydown.tab="wrapFocus"
    >
      <UiContainer class="grid gap-8 py-4">
        <div class="flex justify-end">
          <button
            type="button"
            class="inline-flex min-h-(--target-comfortable) cursor-pointer items-center gap-2 border border-border px-3 font-mono text-step--1 uppercase tracking-label"
            commandfor="site-menu"
            command="close"
            @click="close"
          >
            <UiIcon name="close" />
            {{ $t('layout.menu.close') }}
          </button>
        </div>
        <LayoutSiteNav
          :label="$t('layout.nav.label')"
          layout="column"
        />
      </UiContainer>
    </dialog>
  </div>
</template>

<style>
/* The page behind a modal menu does not scroll */
html:has(.site-menu[open]) {
  overflow: hidden;
}
</style>
