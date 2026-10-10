// Russian is the default; a visitor's explicit choice persists in a cookie.
export default defineNuxtPlugin(async (nuxtApp) => {
  const i18n = nuxtApp.$i18n as { locale: Ref<string>, setLocale: (l: 'ru' | 'en') => Promise<void> }
  const saved = useCookie<'ru' | 'en' | undefined>('lms_locale', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  if (saved.value && saved.value !== i18n.locale.value) await i18n.setLocale(saved.value)
  watch(i18n.locale, (l) => { saved.value = l as 'ru' | 'en' })
})
