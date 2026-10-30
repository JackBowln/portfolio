<script setup lang="ts">
// Admin-only. A project's results (F07-T1, data-model §4.5): label and value, with an optional note on how it was
// measured. Only verifiable results belong here, and the screen says so above the list; the server checks the shape
// (label and value required, at most PROJECT_LIMITS.highlights)
import { PROJECT_LIMITS } from '#shared/content/project-input'
import type { ProjectHighlightInput } from '#shared/content/project-input'

const model = defineModel<ProjectHighlightInput[]>({ required: true })
defineProps<{ errors?: Record<number, string> | undefined }>()

const noteId = useId()

function update(index: number, field: keyof ProjectHighlightInput, value: string) {
  model.value = model.value.map((item, position) => (position === index ? { ...item, [field]: value } : item))
}

function add() {
  model.value = [...model.value, { label: '', value: '' }]
}

function remove(index: number) {
  model.value = model.value.filter((_, position) => position !== index)
}
</script>

<template>
  <fieldset
    class="grid gap-4"
    :aria-describedby="noteId"
  >
    <legend class="font-strong">
      {{ $t('admin.projects.highlights.legend') }}
    </legend>
    <p
      :id="noteId"
      class="border-s-4 border-warning ps-3"
      data-testid="highlights-warning"
    >
      {{ $t('admin.projects.highlights.verifiable') }}
    </p>
    <p
      v-if="model.length === 0"
      class="text-text-muted"
    >
      {{ $t('admin.projects.highlights.empty') }}
    </p>
    <ol
      v-else
      class="grid gap-4"
    >
      <li
        v-for="(item, index) in model"
        :key="index"
        class="grid gap-3 border-b border-border pb-4 sm:grid-cols-2"
      >
        <UiField
          v-slot="field"
          :label="$t('admin.projects.highlights.label', { number: index + 1 })"
          :error="errors?.[index]"
          required
        >
          <UiInput
            :model-value="item.label"
            v-bind="field"
            :maxlength="PROJECT_LIMITS.highlightLabel"
            @update:model-value="update(index, 'label', $event)"
          />
        </UiField>
        <UiField
          v-slot="field"
          :label="$t('admin.projects.highlights.value', { number: index + 1 })"
          required
        >
          <UiInput
            :model-value="item.value"
            v-bind="field"
            :maxlength="PROJECT_LIMITS.highlightValue"
            @update:model-value="update(index, 'value', $event)"
          />
        </UiField>
        <UiField
          v-slot="field"
          class="sm:col-span-2"
          :label="$t('admin.projects.highlights.note', { number: index + 1 })"
          :description="$t('admin.projects.highlights.noteHint')"
        >
          <UiInput
            :model-value="item.note ?? ''"
            v-bind="field"
            :maxlength="PROJECT_LIMITS.highlightNote"
            @update:model-value="update(index, 'note', $event)"
          />
        </UiField>
        <UiButton
          variant="ghost"
          size="sm"
          class="justify-self-start"
          @click="remove(index)"
        >
          {{ $t('admin.projects.highlights.remove', { number: index + 1 }) }}
        </UiButton>
      </li>
    </ol>
    <UiButton
      variant="secondary"
      size="sm"
      class="justify-self-start"
      :disabled="model.length >= PROJECT_LIMITS.highlights"
      @click="add"
    >
      {{ $t('admin.projects.highlights.add') }}
    </UiButton>
  </fieldset>
</template>
