<script setup lang="ts">
import { z } from 'zod'
import type { InvitePublic } from '~~/shared/types'

/** Role invite (mentor, head). Students are invited into a cohort from its Add students (spec invites.md) */
definePageMeta({ roles: ['head'], headScope: 'all' })

const { t, locale } = useI18n()
const toast = useToast()
useHead({ title: () => `${t('inviteForm.title')} · dev.house` })

const roleItems = computed(() => (['mentor', 'head'] as const).map(value => ({ value, label: t(`roles.${value}`), description: t(`inviteForm.${value}Hint`) })))

const schema = computed(() => z.object({
  email: z.string().trim().min(1, t('auth.err.loginRequired')).email(t('invite.err.email')),
  role: z.enum(['mentor', 'head'])
}))

const state = reactive<{ email: string, role: 'mentor' | 'head' }>({ email: '', role: 'mentor' })
const sending = ref(false)
const created = ref<InvitePublic | null>(null)

async function onSubmit() {
  sending.value = true
  try {
    created.value = await $fetch('/api/invites', { method: 'POST', body: { email: state.email.trim(), role: state.role } })
    clearNuxtData(['dashboard-head', 'people'])
  } catch (e) {
    const err = e as { statusCode?: number, data?: { statusMessage?: string } }
    const code = err.data?.statusMessage
    toast.add({
      title: code === 'user_exists' ? t('inviteForm.err.userExists') : code === 'role_unavailable' ? t('inviteForm.err.roleUnavailable') : t('common.saveError'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    sending.value = false
  }
}

function another() {
  created.value = null
  state.email = ''
}

const expiry = computed(() => created.value
  ? new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(created.value.expiresAt))
  : '')
</script>

<template>
  <AppPage :title="t('inviteForm.title')" back="/people">
    <div class="mx-auto w-full max-w-xl">
      <template v-if="created">
        <UIcon name="i-lucide-mail-check" class="size-6 text-success" />
        <h1 class="mt-3 text-xl font-semibold tracking-tight text-highlighted">{{ t('inviteForm.createdTitle') }}</h1>
        <p class="mt-1 text-sm text-muted">{{ t('inviteForm.createdText', { email: created.email, date: expiry }) }}</p>
        <p class="mt-2 text-xs text-muted">{{ t('inviteForm.sendHint') }}</p>

        <div class="mt-8 flex flex-wrap gap-2">
          <UButton :label="t('inviteForm.another')" icon="i-lucide-user-plus" color="neutral" variant="outline" @click="another" />
          <UButton to="/people" :label="t('inviteForm.toPeople')" color="neutral" variant="ghost" />
        </div>
      </template>

      <template v-else>
        <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('inviteForm.title') }}</h1>
        <p class="mt-1 text-sm text-muted">{{ t('inviteForm.subtitle') }}</p>

        <UForm :schema="schema" :state="state" class="mt-8 space-y-5" @submit="onSubmit">
          <UFormField :label="t('auth.email')" name="email">
            <UInput v-model="state.email" type="email" autocomplete="off" inputmode="email" size="lg" class="w-full" />
          </UFormField>

          <UFormField :label="t('inviteForm.role')" name="role">
            <URadioGroup v-model="state.role" :items="roleItems" variant="table" />
          </UFormField>

          <p class="text-sm text-muted">
            {{ t('inviteForm.studentsMoved') }}
            <NuxtLink to="/cohorts" class="text-default underline underline-offset-4 hover:text-highlighted">{{ t('inviteForm.toCohorts') }}</NuxtLink>
          </p>

          <UButton type="submit" :label="t('inviteForm.submit')" icon="i-lucide-send" color="primary" size="lg" :loading="sending" />
        </UForm>
      </template>
    </div>
  </AppPage>
</template>
