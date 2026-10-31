<script setup lang="ts">
// Contact form (F08-T3, RF-01.6): the browser's own constraints with localized messages (no schema library in the
// public bundle); the server validates again and decides. Errors sit under each field and in a summary that takes
// the focus; the result is a live status. Turnstile loads on the first interaction; the honeypot is hidden from
// people and from assistive tech
import { CONTACT_LIMITS } from '#shared/contact/limits'
import type { ContactField } from '#shared/contact/limits'
import { loadTurnstile } from '~/utils/turnstile'

const props = defineProps<{ success: string }>()

const { locale, t } = useI18n()
const config = useRuntimeConfig()

const fields = reactive({ name: '', email: '', message: '', website: '' })
const errors = reactive<Record<ContactField, string | undefined>>({ name: undefined, email: undefined, message: undefined })
const state = ref<'idle' | 'sending' | 'sent'>('idle')
const failure = ref('')
const token = ref('')
const form = ref<HTMLFormElement>()
const widget = ref<HTMLElement>()
const summary = ref<HTMLElement>()
// Set once hydrated: typing before that is overwritten by v-model's first render (tests wait for it)
const ready = ref(false)
onMounted(() => {
  ready.value = true
})
let widgetId: string | undefined
let waitingForToken: { resolve: (value: string) => void, reject: () => void } | undefined

const FIELDS: ContactField[] = ['name', 'email', 'message']
const summaryItems = computed(() => FIELDS.filter(field => errors[field]).map(field => ({ field, message: errors[field]! })))

async function startTurnstile() {
  if (widgetId !== undefined || !widget.value) {
    return
  }
  widgetId = ''
  try {
    const api = await loadTurnstile()
    widgetId = api.render(widget.value, {
      'sitekey': String(config.public.turnstileSiteKey),
      'language': locale.value.toLowerCase(),
      'callback': (value) => {
        token.value = value
        waitingForToken?.resolve(value)
      },
      'expired-callback': () => {
        token.value = ''
      },
      'error-callback': () => {
        token.value = ''
        waitingForToken?.reject()
        failure.value = t('contact.errors.turnstile')
      },
    })
  }
  catch {
    widgetId = undefined
    waitingForToken?.reject()
    failure.value = t('contact.errors.turnstile')
  }
}

function messageFor(element: HTMLInputElement | HTMLTextAreaElement): string | undefined {
  const { validity } = element
  if (validity.valueMissing || (element.required && !element.value.trim())) {
    return t('contact.errors.required')
  }
  if (validity.typeMismatch) {
    return t('contact.errors.invalidEmail')
  }
  if (validity.tooShort || (element.minLength > 0 && element.value.trim().length < element.minLength)) {
    return t('contact.errors.tooShort', { min: element.minLength })
  }
  if (validity.tooLong) {
    return t('contact.errors.tooLong', { max: element.maxLength })
  }
  return undefined
}

function validate(): boolean {
  for (const field of FIELDS) {
    const element = form.value?.elements.namedItem(field) as HTMLInputElement | HTMLTextAreaElement | null
    errors[field] = element ? messageFor(element) : undefined
  }
  return summaryItems.value.length === 0
}

const SERVER_MESSAGES: Record<string, string> = {
  required: 'contact.errors.required',
  invalid_email: 'contact.errors.invalidEmail',
  too_short: 'contact.errors.tooShort',
  too_long: 'contact.errors.tooLong',
}

function serverErrors(issues: { path: string, message: string }[]) {
  for (const issue of issues) {
    const field = issue.path as ContactField
    if (FIELDS.includes(field)) {
      errors[field] = t(SERVER_MESSAGES[issue.message] ?? 'contact.errors.invalid', { min: CONTACT_LIMITS.messageMin, max: field === 'name' ? CONTACT_LIMITS.name : CONTACT_LIMITS.messageMax })
    }
  }
}

function tokenReady(): Promise<string> {
  if (token.value) {
    return Promise.resolve(token.value)
  }
  return new Promise((resolve, reject) => {
    waitingForToken = { resolve, reject }
  })
}

// Plain listeners: event modifiers would pull Vue's withModifiers into the code every public route shares
function onSubmit(event: Event) {
  event.preventDefault()
  void submit()
}

async function submit() {
  failure.value = ''
  if (!validate()) {
    await nextTick()
    summary.value?.focus()
    return
  }
  state.value = 'sending'
  try {
    const ready = tokenReady()
    void startTurnstile()
    const turnstileToken = await ready
    await $fetch('/api/public/contact', {
      method: 'POST',
      body: { name: fields.name, email: fields.email, message: fields.message, locale: locale.value, website: fields.website || undefined, turnstileToken },
    })
    state.value = 'sent'
    Object.assign(fields, { name: '', email: '', message: '', website: '' })
  }
  catch (error) {
    state.value = 'idle'
    const response = (error ?? {}) as { statusCode?: number, data?: { data?: { issues?: { path: string, message: string }[] } } }
    if (response.statusCode === undefined && failure.value) {
      // Turnstile failed before any request; its message is already shown
      return
    }
    if (response.statusCode === 422) {
      serverErrors(response.data?.data?.issues ?? [])
      await nextTick()
      summary.value?.focus()
      return
    }
    failure.value = t(response.statusCode === 429 ? 'contact.errors.rateLimited' : response.statusCode === 400 ? 'contact.errors.turnstile' : 'contact.errors.failed')
  }
  finally {
    // A token is good for one submission
    token.value = ''
    waitingForToken = undefined
    if (widgetId) {
      (window as { turnstile?: { reset: (id: string) => void } }).turnstile?.reset(widgetId)
    }
  }
}
</script>

<template>
  <div class="grid gap-6">
    <UiStatusMessage
      v-if="state === 'sent'"
      tone="success"
      data-testid="contact-sent"
    >
      {{ props.success || $t('contact.sent') }}
    </UiStatusMessage>
    <form
      ref="form"
      class="grid gap-6"
      novalidate
      :aria-label="$t('contact.form.label')"
      :aria-busy="state === 'sending' ? 'true' : undefined"
      :data-ready="ready ? '' : undefined"
      @submit="onSubmit"
      @focusin="startTurnstile"
      @pointerenter="startTurnstile"
    >
      <!-- A class, not v-show: vShow would join the code every public route shares -->
      <div
        ref="summary"
        tabindex="-1"
        role="alert"
        class="gap-2 border-s-4 border-danger bg-surface px-4 py-3"
        :class="summaryItems.length > 0 ? 'grid' : 'hidden'"
        data-testid="contact-errors"
      >
        <p class="font-strong">
          {{ $t('contact.errors.summary', { count: summaryItems.length }) }}
        </p>
        <ul class="list-disc ps-5">
          <li
            v-for="item in summaryItems"
            :key="item.field"
          >
            <a
              :href="`#contact-${item.field}`"
              class="underline underline-offset-(--underline-offset)"
            >{{ $t(`contact.form.${item.field}`) }}: {{ item.message }}</a>
          </li>
        </ul>
      </div>

      <UiField
        id="contact-name"
        v-slot="field"
        :label="$t('contact.form.name')"
        :error="errors.name"
        required
      >
        <UiInput
          v-bind="field"
          v-model="fields.name"
          name="name"
          autocomplete="name"
          :maxlength="CONTACT_LIMITS.name"
        />
      </UiField>
      <UiField
        id="contact-email"
        v-slot="field"
        :label="$t('contact.form.email')"
        :error="errors.email"
        required
      >
        <UiInput
          v-bind="field"
          v-model="fields.email"
          type="email"
          name="email"
          autocomplete="email"
          :maxlength="CONTACT_LIMITS.email"
        />
      </UiField>
      <UiField
        id="contact-message"
        v-slot="field"
        :label="$t('contact.form.message')"
        :description="$t('contact.form.messageHint', { min: CONTACT_LIMITS.messageMin, max: CONTACT_LIMITS.messageMax })"
        :error="errors.message"
        required
      >
        <UiTextarea
          v-bind="field"
          v-model="fields.message"
          name="message"
          :rows="8"
          :minlength="CONTACT_LIMITS.messageMin"
          :maxlength="CONTACT_LIMITS.messageMax"
        />
      </UiField>

      <!-- Honeypot: off-screen, out of the tab order and hidden from assistive tech -->
      <div
        aria-hidden="true"
        class="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label for="contact-website">Website</label>
        <input
          id="contact-website"
          v-model="fields.website"
          type="text"
          name="website"
          tabindex="-1"
          autocomplete="off"
        >
      </div>

      <p class="text-step--1 text-text-muted">
        {{ $t('contact.notice') }}
        <UiLocalizedLink
          to="/privacidade"
          class="underline underline-offset-(--underline-offset) hover:text-accent"
        >
          {{ $t('contact.privacyLink') }}
        </UiLocalizedLink>
      </p>

      <div
        ref="widget"
        class="min-h-16"
        data-testid="turnstile"
      />

      <UiStatusMessage
        v-if="failure"
        tone="danger"
        data-testid="contact-failure"
      >
        {{ failure }}
      </UiStatusMessage>
      <p
        role="status"
        class="sr-only"
      >
        {{ state === 'sending' ? $t('contact.form.sending') : '' }}
      </p>

      <div>
        <UiButton
          type="submit"
          :disabled="state === 'sending'"
        >
          {{ state === 'sending' ? $t('contact.form.sending') : $t('contact.form.submit') }}
        </UiButton>
      </div>
    </form>
  </div>
</template>
