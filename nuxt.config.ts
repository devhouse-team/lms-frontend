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
  modules: ['@nuxt/ui', '@nuxt/fonts', '@nuxtjs/i18n'],
  // The browser calls the LMS API itself with a token it holds, so nothing user-specific can render on the server
  ssr: false,
  css: ['~/assets/css/main.css'],
  typescript: {
    tsConfig: { compilerOptions: STRICT_FLAGS },
    sharedTsConfig: { compilerOptions: STRICT_FLAGS },
    nodeTsConfig: { compilerOptions: STRICT_FLAGS }
  },
  nitro: { typescript: { tsConfig: { compilerOptions: STRICT_FLAGS } } },
  runtimeConfig: {
    /** Server side (Nitro's file redirect); override with NUXT_API_BASE (e.g. http://localhost:8000/api/v1) */
    apiBase: 'https://api.devhouse.kz/api/v1',
    public: {
      /** What the browser calls; NUXT_PUBLIC_API_BASE. The API must allow this site's origin (CORS) */
      apiBase: 'https://api.devhouse.kz/api/v1',
      /** Backend role ids that invites grant (no roles endpoint yet); NUXT_PUBLIC_ROLE_IDS_<ROLE>. 0 = can't invite */
      roleIds: { head: 1, mentor: 2, mentee: 0 }
    }
  },
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
