import { installApiRouter } from '~/api/router'

/** Runs the API handlers in the browser and reopens the session (refresh cookie) before the first route renders */
export default defineNuxtPlugin({
  name: 'api-router',
  enforce: 'pre',
  async setup() {
    const { public: config } = useRuntimeConfig()
    apiConfig.apiBase = config.apiBase as string
    apiConfig.roleIds = config.roleIds as Record<string, number | string>
    installApiRouter()
    await restoreSession()
    sessionReady.value = true
  }
})
