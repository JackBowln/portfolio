<script setup lang="ts">
// Global settings (F08-T1, RF-08): one section per key, each saved on its own with the version it read. Identity,
// SEO defaults and footer have translatable parts (pt-BR, then each locale when the owner writes one). Editors and
// below read them; only owner and admin save (settings:update), and the AI translation section also asks for a recent
// sign-in. The server checks everything again
import { can } from '#shared/auth/permissions'
import { NAVIGATION_PAGES, NEURON_CAP_MAX, SOCIAL_NETWORKS } from '#shared/settings/schemas'
import type { SettingGlobal, SettingLocalized } from '#shared/settings/schemas'
import type { SiteSettingKey } from '#shared/types/enums'
import MediaField from '~/components/admin/media/MediaField.vue'
import SettingsSection from '~/components/admin/settings/SettingsSection.vue'
import { adminFetch, useAdminUser } from '~/utils/admin/session'
import type { AdminSetting } from '~/utils/admin/settings'

definePageMeta({ i18n: false, layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const user = useAdminUser()
const canEdit = computed(() => can(user.value?.role ?? '', { settings: ['update'] }))
const settings = ref<AdminSetting[]>([])
const failed = ref(false)

onMounted(async () => {
  try {
    settings.value = (await adminFetch<{ items: AdminSetting[] }>('/api/admin/settings')).items
  }
  catch {
    failed.value = true
  }
})

function of<K extends SiteSettingKey>(key: K) {
  return settings.value.find(item => item.key === key) as AdminSetting<SettingGlobal<K>, NonNullable<SettingLocalized<K>>> | undefined
}

function saved(setting: AdminSetting<object, object>) {
  settings.value = settings.value.map(item => (item.key === setting.key ? setting as AdminSetting : item))
}

function move<T>(list: T[], index: number, by: -1 | 1) {
  const [item] = list.splice(index, 1)
  list.splice(index + by, 0, item!)
}

const input = 'min-h-(--target-comfortable) border border-border bg-bg px-3'

useHead({ title: () => t('admin.settings.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="grid grid-cols-1 gap-10">
    <div class="grid gap-3">
      <UiHeading
        :level="1"
        :size="4"
      >
        {{ $t('admin.settings.title') }}
      </UiHeading>
      <p class="text-text-muted">
        {{ $t('admin.settings.intro') }}
      </p>
      <UiStatusMessage
        v-if="!canEdit"
        tone="warning"
      >
        {{ $t('admin.settings.readOnly') }}
      </UiStatusMessage>
    </div>

    <UiStatusMessage
      v-if="failed"
      tone="danger"
    >
      {{ $t('admin.common.unexpectedError') }}
    </UiStatusMessage>

    <template v-else-if="settings.length > 0">
      <SettingsSection
        v-if="of('identity')"
        :setting="of('identity')!"
        :title="$t('admin.settings.identity.title')"
        :intro="$t('admin.settings.identity.intro')"
        translatable
        :can-edit="canEdit"
        @saved="saved"
      >
        <template #global="{ value }">
          <UiField
            v-slot="field"
            :label="$t('admin.settings.identity.name')"
            required
          >
            <UiInput
              v-model="value.name"
              v-bind="field"
              :maxlength="80"
            />
          </UiField>
        </template>
        <template #localized="{ text }">
          <UiField
            v-slot="field"
            :label="$t('admin.settings.identity.role')"
          >
            <UiInput
              v-model="text.role"
              v-bind="field"
              :maxlength="120"
            />
          </UiField>
          <UiField
            v-slot="field"
            :label="$t('admin.settings.identity.bio')"
          >
            <UiTextarea
              v-model="text.bio"
              v-bind="field"
              :maxlength="300"
              :rows="3"
            />
          </UiField>
        </template>
      </SettingsSection>

      <SettingsSection
        v-if="of('social')"
        :setting="of('social')!"
        :title="$t('admin.settings.social.title')"
        :intro="$t('admin.settings.social.intro')"
        :can-edit="canEdit"
        @saved="saved"
      >
        <template #global="{ value }">
          <p
            v-if="value.links.length === 0"
            class="text-text-muted"
          >
            {{ $t('admin.settings.social.empty') }}
          </p>
          <ol
            v-else
            class="grid gap-4"
          >
            <li
              v-for="(link, index) in value.links"
              :key="index"
              class="grid gap-3 border-b border-border pb-4 sm:grid-cols-[12rem_1fr]"
            >
              <UiField
                v-slot="field"
                :label="$t('admin.settings.social.network', { number: index + 1 })"
              >
                <select
                  :id="field.id"
                  v-model="link.network"
                  :class="input"
                >
                  <option
                    v-for="network in SOCIAL_NETWORKS"
                    :key="network"
                    :value="network"
                  >
                    {{ $t(`layout.social.${network}`) }}
                  </option>
                </select>
              </UiField>
              <UiField
                v-slot="field"
                :label="$t('admin.settings.social.url', { number: index + 1 })"
                :description="$t('admin.settings.httpsOnly')"
              >
                <UiInput
                  v-model="link.url"
                  v-bind="field"
                  type="url"
                  :maxlength="500"
                />
              </UiField>
              <UiButton
                variant="ghost"
                size="sm"
                class="justify-self-start"
                @click="value.links.splice(index, 1)"
              >
                {{ $t('admin.settings.social.remove', { number: index + 1 }) }}
              </UiButton>
            </li>
          </ol>
          <UiButton
            variant="secondary"
            size="sm"
            class="justify-self-start"
            :disabled="value.links.length >= 10"
            @click="value.links.push({ network: 'github', url: '' })"
          >
            {{ $t('admin.settings.social.add') }}
          </UiButton>
        </template>
      </SettingsSection>

      <SettingsSection
        v-if="of('contact')"
        :setting="of('contact')!"
        :title="$t('admin.settings.contact.title')"
        :intro="$t('admin.settings.contact.intro')"
        :can-edit="canEdit"
        @saved="saved"
      >
        <template #global="{ value }">
          <UiField
            v-slot="field"
            :label="$t('admin.settings.contact.email')"
          >
            <UiInput
              :model-value="value.email ?? ''"
              v-bind="field"
              type="email"
              :maxlength="254"
              @update:model-value="value.email = $event.trim() || null"
            />
          </UiField>
          <label class="inline-flex min-h-(--target-min) items-center gap-2">
            <input
              v-model="value.showEmail"
              type="checkbox"
              class="size-5 accent-accent"
            >
            {{ $t('admin.settings.contact.showEmail') }}
          </label>
        </template>
      </SettingsSection>

      <SettingsSection
        v-if="of('seo_defaults')"
        :setting="of('seo_defaults')!"
        :title="$t('admin.settings.seo.title')"
        :intro="$t('admin.settings.seo.intro')"
        translatable
        :can-edit="canEdit"
        @saved="saved"
      >
        <template #global="{ value }">
          <MediaField
            v-model="value.ogImageMediaId"
            :label="$t('admin.settings.seo.ogImage')"
            :empty="$t('admin.articles.edit.ogImageNone')"
            :choose="$t('admin.articles.edit.chooseOgImage')"
            :change="$t('admin.articles.edit.chooseOgImage')"
            :remove="$t('admin.articles.edit.removeOgImage')"
          />
        </template>
        <template #localized="{ text }">
          <UiField
            v-slot="field"
            :label="$t('admin.settings.seo.titleTemplate')"
            :description="$t('admin.settings.seo.titleTemplateHint')"
            required
          >
            <UiInput
              v-model="text.titleTemplate"
              v-bind="field"
              :maxlength="120"
            />
          </UiField>
          <UiField
            v-slot="field"
            :label="$t('admin.settings.seo.description')"
          >
            <UiTextarea
              v-model="text.description"
              v-bind="field"
              :maxlength="300"
              :rows="3"
            />
          </UiField>
        </template>
      </SettingsSection>

      <SettingsSection
        v-if="of('navigation')"
        :setting="of('navigation')!"
        :title="$t('admin.settings.navigation.title')"
        :intro="$t('admin.settings.navigation.intro')"
        :can-edit="canEdit"
        @saved="saved"
      >
        <template #global="{ value }">
          <ol class="grid gap-2">
            <li
              v-for="(page, index) in value.items"
              :key="page"
              class="flex flex-wrap items-center gap-3 border-b border-border py-2"
            >
              <span class="font-strong">{{ index + 1 }}. {{ $t(`layout.nav.${page}`) }}</span>
              <UiButton
                variant="secondary"
                size="sm"
                :disabled="index === 0"
                :aria-label="$t('admin.settings.navigation.up', { page: $t(`layout.nav.${page}`) })"
                @click="move(value.items, index, -1)"
              >
                {{ $t('admin.projects.order.up') }}
              </UiButton>
              <UiButton
                variant="secondary"
                size="sm"
                :disabled="index === value.items.length - 1"
                :aria-label="$t('admin.settings.navigation.down', { page: $t(`layout.nav.${page}`) })"
                @click="move(value.items, index, 1)"
              >
                {{ $t('admin.projects.order.down') }}
              </UiButton>
              <UiButton
                variant="ghost"
                size="sm"
                :aria-label="$t('admin.settings.navigation.hide', { page: $t(`layout.nav.${page}`) })"
                @click="value.items.splice(index, 1)"
              >
                {{ $t('admin.settings.navigation.hideShort') }}
              </UiButton>
            </li>
          </ol>
          <div
            v-if="NAVIGATION_PAGES.some(page => !value.items.includes(page))"
            class="flex flex-wrap gap-2"
          >
            <UiButton
              v-for="page in NAVIGATION_PAGES.filter(item => !value.items.includes(item))"
              :key="page"
              variant="secondary"
              size="sm"
              @click="value.items.push(page)"
            >
              {{ $t('admin.settings.navigation.show', { page: $t(`layout.nav.${page}`) }) }}
            </UiButton>
          </div>
        </template>
      </SettingsSection>

      <SettingsSection
        v-if="of('footer')"
        :setting="of('footer')!"
        :title="$t('admin.settings.footer.title')"
        translatable
        :can-edit="canEdit"
        @saved="saved"
      >
        <template #global="{ value }">
          <label class="inline-flex min-h-(--target-min) items-center gap-2">
            <input
              v-model="value.showSocial"
              type="checkbox"
              class="size-5 accent-accent"
            >
            {{ $t('admin.settings.footer.showSocial') }}
          </label>
        </template>
        <template #localized="{ text }">
          <UiField
            v-slot="field"
            :label="$t('admin.settings.footer.text')"
          >
            <UiTextarea
              v-model="text.text"
              v-bind="field"
              :maxlength="200"
              :rows="2"
            />
          </UiField>
        </template>
      </SettingsSection>

      <SettingsSection
        v-if="of('features')"
        :setting="of('features')!"
        :title="$t('admin.settings.features.title')"
        :can-edit="canEdit"
        @saved="saved"
      >
        <template #global="{ value }">
          <label class="inline-flex min-h-(--target-min) items-center gap-2">
            <input
              v-model="value.contactForm"
              type="checkbox"
              class="size-5 accent-accent"
            >
            {{ $t('admin.settings.features.contactForm') }}
          </label>
          <label class="inline-flex min-h-(--target-min) items-center gap-2">
            <input
              v-model="value.rss"
              type="checkbox"
              class="size-5 accent-accent"
            >
            {{ $t('admin.settings.features.rss') }}
          </label>
        </template>
      </SettingsSection>

      <SettingsSection
        v-if="of('ai_translation')"
        :setting="of('ai_translation')!"
        :title="$t('admin.settings.ai.title')"
        :intro="$t('admin.settings.ai.intro')"
        :can-edit="canEdit"
        @saved="saved"
      >
        <template #global="{ value }">
          <label class="inline-flex min-h-(--target-min) items-center gap-2">
            <input
              v-model="value.enabled"
              type="checkbox"
              class="size-5 accent-accent"
            >
            {{ $t('admin.settings.ai.enabled') }}
          </label>
          <p class="text-step--1">
            {{ $t('admin.settings.ai.provider') }}
          </p>
          <UiField
            v-slot="field"
            :label="$t('admin.settings.ai.model')"
            :description="$t('admin.settings.ai.modelHint')"
          >
            <UiInput
              v-model="value.model"
              v-bind="field"
              :maxlength="120"
            />
          </UiField>
          <div class="grid gap-4 sm:grid-cols-3">
            <UiField
              v-slot="field"
              :label="$t('admin.settings.ai.dailyNeuronCap')"
              :description="$t('admin.settings.ai.dailyNeuronCapHint', { max: NEURON_CAP_MAX })"
            >
              <input
                :id="field.id"
                v-model.number="value.dailyNeuronCap"
                type="number"
                min="0"
                :max="NEURON_CAP_MAX"
                step="1"
                :class="input"
                :aria-describedby="field.describedby"
              >
            </UiField>
            <UiField
              v-slot="field"
              :label="$t('admin.settings.ai.monthlyBudget')"
              :description="$t('admin.settings.ai.microUsdHint')"
            >
              <input
                :id="field.id"
                v-model.number="value.monthlyBudgetMicroUsd"
                type="number"
                min="0"
                step="1"
                :class="input"
                :aria-describedby="field.describedby"
              >
            </UiField>
            <UiField
              v-slot="field"
              :label="$t('admin.settings.ai.perJobMax')"
              :description="$t('admin.settings.ai.microUsdHint')"
            >
              <input
                :id="field.id"
                v-model.number="value.perJobMaxMicroUsd"
                type="number"
                min="0"
                step="1"
                :class="input"
                :aria-describedby="field.describedby"
              >
            </UiField>
          </div>
          <div
            v-for="code in (['en', 'es', 'de', 'fr'] as const)"
            :key="code"
            class="grid gap-3 border-b border-border pb-4 sm:grid-cols-[12rem_1fr]"
          >
            <UiField
              v-slot="field"
              :label="$t('admin.settings.ai.formality', { locale: $t(`admin.articles.locales.${code}`) })"
            >
              <select
                :id="field.id"
                v-model="value.style[code].formality"
                :class="input"
              >
                <option value="informal">
                  {{ $t('admin.settings.ai.informal') }}
                </option>
                <option value="formal">
                  {{ $t('admin.settings.ai.formal') }}
                </option>
              </select>
            </UiField>
            <UiField
              v-slot="field"
              :label="$t('admin.settings.ai.notes', { locale: $t(`admin.articles.locales.${code}`) })"
            >
              <UiInput
                :model-value="value.style[code].notes ?? ''"
                v-bind="field"
                :maxlength="500"
                @update:model-value="value.style[code].notes = $event || undefined"
              />
            </UiField>
          </div>
        </template>
      </SettingsSection>
    </template>
  </div>
</template>
