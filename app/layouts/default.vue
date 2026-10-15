<script setup lang="ts">
import type { CommandPaletteGroup, DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import type { Role } from '~~/shared/types'

const { t, locale, setLocale } = useI18n()
const { user, role, logout, switchRole } = useAuth()
const open = ref(false)

const navByRole: Record<Role, { key: string, icon: string, to: string }[]> = {
  mentee: [
    { key: 'home', icon: 'i-lucide-layout-dashboard', to: '/' },
    { key: 'courses', icon: 'i-lucide-book-open', to: '/courses' },
    { key: 'assignments', icon: 'i-lucide-git-pull-request', to: '/assignments' },
    { key: 'contest', icon: 'i-lucide-trophy', to: '/contest' },
    { key: 'career', icon: 'i-lucide-briefcase', to: '/career' },
    { key: 'mentor', icon: 'i-lucide-messages-square', to: '/mentor' }
  ],
  mentor: [
    { key: 'home', icon: 'i-lucide-layout-dashboard', to: '/' },
    { key: 'reviews', icon: 'i-lucide-git-pull-request', to: '/reviews' },
    { key: 'cohort', icon: 'i-lucide-users', to: '/cohort' },
    { key: 'sessions', icon: 'i-lucide-calendar', to: '/sessions' },
    { key: 'contest', icon: 'i-lucide-trophy', to: '/contest' }
  ],
  head: [
    { key: 'home', icon: 'i-lucide-layout-dashboard', to: '/' },
    { key: 'cohorts', icon: 'i-lucide-users', to: '/cohorts' },
    { key: 'people', icon: 'i-lucide-contact', to: '/people' },
    { key: 'programs', icon: 'i-lucide-library', to: '/programs' },
    { key: 'contests', icon: 'i-lucide-trophy', to: '/contests' }
  ]
}

const items = computed<NavigationMenuItem[]>(() =>
  (role.value ? navByRole[role.value] : []).map(i => ({
    label: t(`nav.${i.key}`),
    icon: i.icon,
    to: i.to,
    onSelect: () => (open.value = false)
  }))
)

const groups = computed<CommandPaletteGroup[]>(() => [{
  id: 'nav',
  label: t('nav.jumpTo'),
  items: items.value.map(i => ({ label: i.label as string, icon: i.icon, to: i.to }))
}])

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: user.value?.email }],
  // Several views (e.g. mentor in one cohort, student in another): switch instead of picking one
  ...((user.value?.roles.length ?? 0) > 1
    ? [[
        { type: 'label' as const, label: t('auth.switchRole') },
        ...user.value!.roles.map(r => ({ label: t(`roles.${r}`), type: 'checkbox' as const, checked: r === role.value, onSelect: () => r !== role.value && switchRole(r) }))
      ]]
    : []),
  [
    { label: 'Русский', type: 'checkbox', checked: locale.value === 'ru', onSelect: () => setLocale('ru') },
    { label: 'English', type: 'checkbox', checked: locale.value === 'en', onSelect: () => setLocale('en') }
  ],
  [{ label: t('auth.logout'), icon: 'i-lucide-log-out', onSelect: () => logout() }]
])
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      v-model:open="open"
      collapsible
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center px-1.5 py-1" :class="collapsed && 'justify-center'" aria-label="dev.house">
          <img v-if="collapsed" src="/brand/devhouse-mark.png" alt="" class="size-6" width="24" height="24">
          <img v-else src="/brand/devhouse-logo.png" alt="dev.house" class="h-6 w-auto" width="124" height="24">
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" :label="t('nav.search')" class="mb-2" />
        <UNavigationMenu :collapsed="collapsed" :items="items" orientation="vertical" tooltip />
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu v-if="user" :items="userMenu" :content="{ side: 'top', align: 'start' }" :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-56' }">
          <UButton color="neutral" variant="ghost" block :square="collapsed" class="justify-start gap-2.5 py-1.5" :aria-label="t('auth.account')">
            <UAvatar :src="user.avatar" :alt="user.name" size="sm" />
            <span v-if="!collapsed" class="min-w-0 flex-1 text-left">
              <span class="block truncate text-sm font-medium text-highlighted">{{ user.name }}</span>
              <span class="block truncate text-xs text-muted">{{ t(`roles.${user.role}`) }}</span>
            </span>
            <UIcon v-if="!collapsed" name="i-lucide-chevrons-up-down" class="size-4 shrink-0 text-dimmed" />
          </UButton>
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" :placeholder="t('nav.search')" />

    <slot />
  </UDashboardGroup>
</template>
