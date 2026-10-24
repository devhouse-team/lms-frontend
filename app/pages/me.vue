<script setup lang="ts">
import { z } from 'zod'

const { t } = useI18n()
const toast = useToast()
const { fetch: refreshSession, clear: clearSession } = useUserSession()
useHead({ title: () => `${t('me.title')} · dev.house` })

const { data, status, refresh } = await useFetch('/api/me', { key: 'me' })

/* ---------- profile ---------- */
const profileSchema = computed(() => z.object({
  name: z.string().trim().min(2, t('invite.err.name')).max(80, t('invite.err.name')),
  username: z.string().trim().regex(/^[a-z0-9_]{2,32}$/, t('invite.err.username')),
  leetcode: z.string().trim().regex(/^([A-Za-z0-9_-]{1,30})?$/, t('me.err.leetcode'))
}))
const profile = reactive({ name: '', username: '', leetcode: '' })
watch(data, (d) => {
  if (d) Object.assign(profile, { name: d.name, username: d.username, leetcode: d.leetcode ?? '' })
}, { immediate: true })
const profileDirty = computed(() => !!data.value && (
  profile.name.trim() !== data.value.name
  || profile.username.trim() !== data.value.username
  || profile.leetcode.trim() !== (data.value.leetcode ?? '')
))
const profileSaving = ref(false)
const profileError = ref<{ username?: string, general?: string, leetcode?: string }>({})

async function saveProfile() {
  if (!data.value) return
  profileError.value = {}
  profileSaving.value = true
  const body: { name?: string, username?: string, leetcode?: string | null } = {}
  try {
    if (profile.name.trim() !== data.value.name) body.name = profile.name.trim()
    if (profile.username.trim() !== data.value.username) body.username = profile.username.trim()
    if (profile.leetcode.trim() !== (data.value.leetcode ?? '')) body.leetcode = profile.leetcode.trim() || null
    await $fetch('/api/me', { method: 'PATCH', body })
    await Promise.all([refreshSession(), refresh()])
    toast.add({ title: t('me.saved'), color: 'success', icon: 'i-lucide-check' })
  } catch (e) {
    const err = apiError(e)
    const leetcode = err.field('leetcode_id')
    if (err.status === 409) profileError.value = body.username ? { username: t('me.taken') } : { leetcode: t('me.leetcodeTaken') }
    else profileError.value = { username: err.field('username'), leetcode, general: err.field('name') ?? (err.field('username') || leetcode ? undefined : t('common.saveError')) }
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

/* ---------- email: resend verification ---------- */
const resending = ref(false)
const resent = ref(false)
const resendError = ref<string>()
const cooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | undefined
onBeforeUnmount(() => clearInterval(cooldownTimer))
async function resend() {
  resendError.value = undefined
  resending.value = true
  try {
    await $fetch('/api/me/verify-email', { method: 'POST' })
    resent.value = true
    cooldown.value = 60
    clearInterval(cooldownTimer)
    cooldownTimer = setInterval(() => {
      if (--cooldown.value <= 0) clearInterval(cooldownTimer)
    }, 1000)
  } catch (e) {
    const err = apiError(e)
    resendError.value = err.status === 429 ? t('me.rateLimited') : err.status === 502 ? t('auth.err.network') : t('common.saveError')
  } finally {
    resending.value = false
  }
}

/* ---------- email: change ---------- */
const changing = ref(false)
const changeSentTo = ref<string>()
const emailSchema = computed(() => z.object({
  newEmail: z.string().trim().email(t('invite.err.email')).max(254, t('invite.err.email'))
    .refine(v => v.toLowerCase() !== data.value?.email.toLowerCase(), t('me.sameEmail')),
  password: z.string().min(1, t('me.err.current'))
}))
const emailForm = reactive({ newEmail: '', password: '' })
const emailSaving = ref(false)
const emailError = ref<{ newEmail?: string, password?: string, general?: string }>({})
const sentNote = useTemplateRef<HTMLElement>('sentNote')
async function toggleChange() {
  changing.value = !changing.value
  if (changing.value) {
    await nextTick()
    document.getElementById('new-email')?.focus()
  }
}
async function changeEmail() {
  emailError.value = {}
  emailSaving.value = true
  try {
    await $fetch('/api/me/email', { method: 'POST', body: { newEmail: emailForm.newEmail.trim(), password: emailForm.password } })
    changeSentTo.value = emailForm.newEmail.trim()
    Object.assign(emailForm, { newEmail: '', password: '' })
    await nextTick()
    sentNote.value?.focus()
  } catch (e) {
    const err = apiError(e)
    // The API's 400 (bad_request) is a wrong password; Nitro's own 400 is a malformed body the form already prevents
    if (err.code === 'bad_request') emailError.value = { password: t('me.wrongPassword') }
    else if (err.status === 422) emailError.value = { newEmail: err.field('new_email') ?? err.message ?? t('common.saveError') }
    else if (err.status === 429) emailError.value = { general: t('me.rateLimited') }
    else emailError.value = { general: err.status === 502 ? t('auth.err.network') : t('common.saveError') }
  } finally {
    emailSaving.value = false
  }
}
function otherAddress() {
  changeSentTo.value = undefined
  nextTick(() => document.getElementById('new-email')?.focus())
}

/* ---------- sessions ---------- */
const logoutAllOpen = ref(false)
const loggingOut = ref(false)
async function logoutAll() {
  loggingOut.value = true
  try {
    await $fetch('/api/auth/logout-all', { method: 'POST' })
  } catch (e) {
    if (apiError(e).status !== 401) {
      loggingOut.value = false
      toast.add({ title: apiError(e).status === 502 ? t('auth.err.network') : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
      return
    }
  }
  await clearSession()
  clearNuxtData()
  toast.add({ title: t('me.loggedOutAll'), color: 'success', icon: 'i-lucide-check' })
  await navigateTo('/login')
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
              <UFormField :label="t('invite.leetcode')" name="leetcode" :error="profileError.leetcode">
                <UInput v-model="profile.leetcode" autocomplete="off" autocapitalize="none" spellcheck="false" class="w-full" />
              </UFormField>
              <UButton type="submit" color="primary" :label="t('common.save')" :loading="profileSaving" :disabled="!profileDirty" />
            </UForm>
          </section>

          <section aria-labelledby="email-title">
            <h2 id="email-title" class="text-sm font-semibold text-highlighted">{{ t('me.email') }}</h2>
            <p class="num mt-1 flex flex-wrap items-center gap-2 text-sm text-default">
              {{ data.email }}
              <UBadge
                :label="data.emailVerified ? t('person.verified') : t('person.unverified')"
                :icon="data.emailVerified ? 'i-lucide-check' : 'i-lucide-mail-warning'"
                :color="data.emailVerified ? 'success' : 'neutral'"
                variant="subtle"
                size="sm"
              />
            </p>
            <div v-if="!data.emailVerified" class="mt-4 max-w-md space-y-2 rounded-lg bg-elevated p-4 ring-1 ring-inset ring-default">
              <p class="text-sm text-default">{{ t('me.unverified') }}</p>
              <UButton
                :label="cooldown > 0 ? t('me.resendWait', { n: cooldown }) : t('me.resend')"
                icon="i-lucide-mail"
                color="neutral"
                variant="outline"
                size="sm"
                :loading="resending"
                :disabled="cooldown > 0"
                aria-live="off"
                @click="resend"
              />
              <p v-if="resent" class="text-xs text-muted" role="status">{{ t('me.resent', { email: data.email }) }}</p>
              <p v-if="resendError" class="text-xs text-error" role="alert">{{ resendError }}</p>
            </div>

            <UButton
              class="mt-4"
              :label="t('me.changeEmail')"
              :trailing-icon="changing ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-expanded="changing"
              aria-controls="change-email"
              @click="toggleChange"
            />
            <div v-show="changing" id="change-email" class="mt-3 max-w-md">
              <div v-if="changeSentTo" ref="sentNote" tabindex="-1" role="status" class="space-y-3 focus:outline-none">
                <p class="text-sm text-default">{{ t('me.changeSent', { email: changeSentTo, current: data.email }) }}</p>
                <UButton :label="t('me.otherAddress')" color="neutral" variant="outline" size="sm" @click="otherAddress" />
              </div>
              <UForm v-else :schema="emailSchema" :state="emailForm" class="space-y-4" @submit="changeEmail">
                <UFormField :label="t('me.newEmail')" name="newEmail" :error="emailError.newEmail">
                  <UInput id="new-email" v-model="emailForm.newEmail" type="email" autocomplete="email" inputmode="email" class="w-full" />
                </UFormField>
                <UFormField :label="t('me.current')" name="password" :error="emailError.password">
                  <UInput v-model="emailForm.password" type="password" autocomplete="current-password" class="w-full" />
                </UFormField>
                <UAlert v-if="emailError.general" :description="emailError.general" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />
                <UButton type="submit" color="primary" :label="t('me.sendLink')" :loading="emailSaving" />
              </UForm>
            </div>
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

          <section aria-labelledby="ntf-title">
            <h2 id="ntf-title" class="text-sm font-semibold text-highlighted">{{ t('me.notifications') }}</h2>
            <p class="mt-1 text-sm text-muted">
              <NuxtLink to="/notifications#email" class="text-default underline underline-offset-4 hover:text-highlighted">{{ t('me.notificationsLink') }}</NuxtLink>
            </p>
          </section>

          <section aria-labelledby="ses-title">
            <h2 id="ses-title" class="text-sm font-semibold text-highlighted">{{ t('me.sessions') }}</h2>
            <p class="mt-1 text-sm text-muted">{{ t('me.logoutAllHint') }}</p>
            <UButton class="mt-4" :label="t('me.logoutAll')" icon="i-lucide-log-out" color="error" variant="outline" @click="logoutAllOpen = true" />
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

    <UModal v-model:open="logoutAllOpen" :title="t('me.logoutAllTitle')" :description="t('me.logoutAllText')">
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" autofocus @click="logoutAllOpen = false" />
        <UButton :label="t('me.logoutAllConfirm')" color="error" :loading="loggingOut" @click="logoutAll" />
      </template>
    </UModal>
  </AppPage>
</template>
