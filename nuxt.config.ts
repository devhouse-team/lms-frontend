const STRICT_FLAGS = {
  noImplicitOverride: true,
  noImplicitReturns: true,
  noFallthroughCasesInSwitch: true
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: { head: { link: [{ rel: 'icon', href: '/favicon.ico' }] } },
  modules: ['@nuxt/ui', '@nuxt/fonts', '@nuxtjs/i18n', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  typescript: {
    tsConfig: { compilerOptions: STRICT_FLAGS },
    sharedTsConfig: { compilerOptions: STRICT_FLAGS },
    nodeTsConfig: { compilerOptions: STRICT_FLAGS }
  },
  nitro: { typescript: { tsConfig: { compilerOptions: STRICT_FLAGS } } },
  runtimeConfig: { testPassword: '' },
  colorMode: { preference: 'dark', fallback: 'dark' },
  fonts: {
    families: [
      { name: 'Geist', provider: 'google', weights: [400, 500, 600, 700], subsets: ['latin', 'cyrillic'] },
      { name: 'Geist Mono', provider: 'google', weights: [400, 500], subsets: ['latin', 'cyrillic'] }
    ]
  },
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'ru',
    locales: [
      { code: 'ru', language: 'ru-RU', name: 'Русский', file: 'ru.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' }
    ],
    langDir: 'locales',
    detectBrowserLanguage: false
  }
})
