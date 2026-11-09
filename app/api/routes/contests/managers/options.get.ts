import type { components } from '~~/shared/types/api'
import type { PersonOption } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

type S = components['schemas']

/** Every account, for the LeetCode mentor picker (the page hides those already chosen) */
export default defineEventHandler(async (event): Promise<PersonOption[]> => {
  await requireSuperuser(event)
  const users: S['UserRead'][] = []
  for (let page = 1; ; page++) {
    const res = await apiFetch<S['PaginatedListResponse_UserRead_']>(event, '/users/', { query: { page, items_per_page: 100 } })
    users.push(...res.data)
    if (!res.has_more || !res.data.length) break
  }
  return users.filter(u => !u.is_deleted)
    .map(u => ({ id: String(u.id), name: u.name, email: u.email, username: u.username, avatar: avatarUrl(u.profile_image_url) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
})
