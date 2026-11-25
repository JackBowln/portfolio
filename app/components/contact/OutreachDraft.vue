<script setup lang="ts">
// The outreach draft (F13-T7, decision D-02): a helper under the contact form. The visitor describes the opportunity,
// picks a tone and gets a draft to copy and edit. It is client-only and loads on its own chunk (see contato.vue), and it
// sends nothing: no request, nothing stored. Its messages come from outreach-messages.ts, not the shared locale files
import { OUTREACH_MESSAGES } from './outreach-messages'
import type { OutreachLocale } from './outreach-messages'
import { draftOutreach } from '~/utils/outreach/draft'
import type { OutreachCopy, OutreachTone } from '~/utils/outreach/draft'

const TONES = ['professional', 'concise', 'warm'] as const satisfies readonly OutreachTone[]
const { locale } = useI18n()
const m = computed(() => OUTREACH_MESSAGES[locale.value as OutreachLocale] ?? OUTREACH_MESSAGES['pt-BR'])
const ids = { title: useId(), tone: useId() }

const copy = computed<OutreachCopy>(() => ({
  greeting: m.value.greeting,
  presentation: m.value.presentation,
  forCompany: m.value.forCompany,
  forOpportunity: m.value.forOpportunity,
  closing: m.value.closing,
}))

const form = reactive({ name: '', company: '', opportunity: '', tone: 'professional' as OutreachTone })
const draft = ref('')
const missing = ref(false)
const status = ref('')

function generate() {
  missing.value = form.opportunity.trim() === ''
  status.value = ''
  draft.value = missing.value ? '' : draftOutreach(form, copy.value)
}

async function copyDraft() {
  try {
    await navigator.clipboard.writeText(draft.value)
    status.value = m.value.copied
  }
  catch {
    status.value = m.value.copyFailed
  }
}
</script>

<template>
  <section
    class="grid gap-6 border-t border-border pt-8"
    :aria-labelledby="ids.title"
  >
    <UiHeading
      :id="ids.title"
      :level="2"
      :size="4"
    >
      {{ m.title }}
    </UiHeading>
    <p class="text-text-muted">
      {{ m.intro }}
    </p>
    <form
      class="grid gap-6"
      novalidate
      @submit.prevent="generate"
    >
      <UiField
        v-slot="field"
        :label="m.name"
      >
        <UiInput
          v-model="form.name"
          v-bind="field"
          :maxlength="60"
          autocomplete="name"
        />
      </UiField>
      <UiField
        v-slot="field"
        :label="m.company"
      >
        <UiInput
          v-model="form.company"
          v-bind="field"
          :maxlength="80"
        />
      </UiField>
      <UiField
        v-slot="field"
        :label="m.opportunity"
        :error="missing ? m.required : undefined"
      >
        <UiTextarea
          v-model="form.opportunity"
          v-bind="field"
          :maxlength="1000"
          :rows="4"
        />
      </UiField>
      <fieldset class="grid gap-2">
        <legend class="font-strong">
          {{ m.tone }}
        </legend>
        <label
          v-for="tone in TONES"
          :key="tone"
          class="inline-flex min-h-(--target-min) items-center gap-2"
        >
          <input
            v-model="form.tone"
            type="radio"
            :name="ids.tone"
            :value="tone"
          >
          {{ m.tones[tone] }}
        </label>
      </fieldset>
      <UiButton
        type="submit"
        class="justify-self-start"
      >
        {{ m.submit }}
      </UiButton>
    </form>

    <div
      v-if="draft"
      class="grid gap-4"
    >
      <UiField
        v-slot="field"
        :label="m.output"
      >
        <UiTextarea
          :model-value="draft"
          v-bind="field"
          readonly
          :rows="12"
        />
      </UiField>
      <UiButton
        variant="secondary"
        class="justify-self-start"
        @click="copyDraft"
      >
        {{ m.copy }}
      </UiButton>
    </div>
    <p
      role="status"
      aria-live="polite"
      class="text-step--1"
    >
      {{ status }}
    </p>
  </section>
</template>
