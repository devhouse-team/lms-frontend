<script setup lang="ts">
import { z } from 'zod'

const { t } = useI18n()
const toast = useToast()
const { fetch: refreshSession } = useUserSession()
useHead({ title: () => `${t('me.title')} · dev.house` })

const { data, status, refresh } = await useFetch('/api/me', { key: 'me' })

/* ---------- profile ---------- */
const profileSchema = computed(() => z.object({
  name: z.string().trim().min(2, t('invite.err.name')).max(80, t('invite.err.name')),
  username: z.string().trim().regex(/^[a-z0-9_]{2,32}$/, t('invite.err.username'))
}))
const profile = reactive({ name: '', username: '' })
watch(data, (d) => {
  if (d) Object.assign(profile, { name: d.name, username: d.username })
}, { immediate: true })
const profileDirty = computed(() => !!data.value && (profile.name.trim() !== data.value.name || profile.username.trim() !== data.value.username))
const profileSaving = ref(false)
const profileError = ref<{ username?: string, general?: string }>({})

async function saveProfile() {
  if (!data.value) return
  profileError.value = {}
  profileSaving.value = true
  try {
    const body: { name?: string, username?: string } = {}
    if (profile.name.trim() !== data.value.name) body.name = profile.name.trim()
    if (profile.username.trim() !== data.value.username) body.username = profile.username.trim()
    await $fetch('/api/me', { method: 'PATCH', body })
    await Promise.all([refreshSession(), refresh()])
    toast.add({ title: t('me.saved'), color: 'success', icon: 'i-lucide-check' })
  } catch (e) {
    const err = apiError(e)
    if (err.status === 409) profileError.value = { username: t('me.taken') }
    else profileError.value = { username: err.field('username'), general: err.field('name') ?? (err.field('username') ? undefined : t('common.saveError')) }
  } finally {
    profileSaving.value = false
  }
}

/* ---------- password ---------- */
const passwordSchema_ = computed(() => z.object({
  current: z.string().min(1, t('me.err.current')),
  password: passwordSchema(t),
  confirm: z.string()
}).refine(v => v.password === v.confirm, { message: t('invite.err.confirm'), path: ['confirm'] }))
const pw = reactive({ current: '', password: '', confirm: '' })
const pwSaving = ref(false)
const pwError = ref<{ current?: string, password?: string, general?: string }>({})

async function changePassword() {
  pwError.value = {}
  pwSaving.value = true
  try {
    await $fetch('/api/me/password', { method: 'POST', body: { currentPassword: pw.current, newPassword: pw.password } })
    Object.assign(pw, { current: '', password: '', confirm: '' })
    toast.add({ title: t('me.passwordChanged'), color: 'success', icon: 'i-lucide-check' })
  } catch (e) {
    const err = apiError(e)
    if (err.status === 429) pwError.value = { general: t('me.rateLimited') }
    else if (err.status === 422) pwError.value = { current: err.field('current_password'), password: err.field('new_password') ?? err.message ?? t('common.saveError') }
    else if (err.status === 400 || err.status === 403) pwError.value = { current: t('me.wrongPassword') }
    else pwError.value = { general: t('common.saveError') }
  } finally {
    pwSaving.value = false
  }
}
</script>

<template>
  <AppPage :title="t('me.title')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto grid w-full max-w-5xl gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="min-w-0 space-y-10">
          <section aria-labelledby="profile-title">
            <h2 id="profile-title" class="text-sm font-semibold text-highlighted">{{ t('me.profile') }}</h2>
            <p class="mt-1 text-sm text-muted">{{ t('me.profileHint') }}</p>
            <UForm :schema="profileSchema" :state="profile" class="mt-4 max-w-md space-y-4" @submit="saveProfile">
              <UFormField :label="t('invite.name')" name="name" :error="profileError.general">
                <UInput v-model="profile.name" autocomplete="name" class="w-full" />
              </UFormField>
              <UFormField :label="t('invite.username')" name="username" :hint="t('invite.usernameHint')" :error="profileError.username">
                <UInput v-model="profile.username" autocomplete="username" autocapitalize="none" spellcheck="false" class="w-full" />
              </UFormField>
              <UButton type="submit" color="primary" :label="t('common.save')" :loading="profileSaving" :disabled="!profileDirty" />
            </UForm>
          </section>

          <section aria-labelledby="pw-title">
            <h2 id="pw-title" class="text-sm font-semibold text-highlighted">{{ t('me.password') }}</h2>
            <p class="mt-1 text-sm text-muted">{{ t('me.passwordHint') }}</p>
            <UForm :schema="passwordSchema_" :state="pw" class="mt-4 max-w-md space-y-4" @submit="changePassword">
              <UFormField :label="t('me.current')" name="current" :error="pwError.current">
                <UInput v-model="pw.current" type="password" autocomplete="current-password" class="w-full" />
              </UFormField>
              <UFormField :label="t('me.new')" name="password" :help="pwError.password ? undefined : t('password.rules')" :error="pwError.password">
                <UInput v-model="pw.password" type="password" autocomplete="new-password" class="w-full" />
              </UFormField>
              <UFormField :label="t('invite.confirm')" name="confirm">
                <UInput v-model="pw.confirm" type="password" autocomplete="new-password" class="w-full" />
              </UFormField>
              <UAlert v-if="pwError.general" :description="pwError.general" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />
              <UButton type="submit" color="primary" :label="t('me.changePassword')" :loading="pwSaving" />
            </UForm>
          </section>
        </div>

        <HomeRail>
          <section class="p-4" aria-labelledby="acc-title">
            <h2 id="acc-title" class="sr-only">{{ t('me.account') }}</h2>
            <div class="flex items-center gap-3">
              <UAvatar :src="data.avatar" :alt="data.name" size="lg" />
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-highlighted">{{ data.name }}</p>
                <p class="num truncate text-xs text-muted">@{{ data.username }}</p>
              </div>
            </div>
            <p class="num mt-3 truncate text-sm text-toned" :title="data.email">{{ data.email }}</p>
            <UBadge
              class="mt-1.5"
              :label="data.emailVerified ? t('person.verified') : t('person.unverified')"
              :icon="data.emailVerified ? 'i-lucide-check' : 'i-lucide-mail-warning'"
              :color="data.emailVerified ? 'success' : 'neutral'"
              variant="subtle"
              size="sm"
            />
            <div class="mt-4 flex flex-wrap gap-1.5">
              <UBadge v-for="r in data.roles" :key="r" :label="t(`roles.${r}`)" color="primary" variant="subtle" size="sm" />
            </div>
          </section>
          <section class="p-4" aria-labelledby="coh-title">
            <h2 id="coh-title" class="text-sm font-semibold text-highlighted">{{ t('me.cohorts') }}</h2>
            <ul v-if="data.cohorts.length" class="mt-3 space-y-3">
              <li v-for="c in data.cohorts" :key="`${c.cohortId}-${c.relation}`" class="min-w-0">
                <p class="num truncate text-sm text-highlighted" :title="c.cohortName">{{ c.cohortName }}</p>
                <p class="truncate text-xs text-muted">{{ t(`me.relation.${c.relation}`) }}<span v-if="c.enrollment"> · {{ t(`enrollment.${c.enrollment}`) }}</span></p>
              </li>
            </ul>
            <p v-else class="mt-3 text-sm text-muted">{{ t('me.noCohorts') }}</p>
          </section>
          <section v-if="data.ledPrograms.length" class="p-4" aria-labelledby="prog-title">
            <h2 id="prog-title" class="text-sm font-semibold text-highlighted">{{ t('me.programsLed') }}</h2>
            <ul class="mt-3 space-y-2">
              <li v-for="p in data.ledPrograms" :key="p.id" class="truncate text-sm text-highlighted" :title="p.title">{{ p.title }}</li>
            </ul>
          </section>
        </HomeRail>
      </div>
    </HomeState>
  </AppPage>
</template>
