declare module '#auth-utils' {
  interface User {
    id: string
    /** Active view; one of `roles` */
    role: import('./index').Role
    /** Every view this account can switch to (head, mentor, mentee) */
    roles: import('./index').Role[]
    name: string
    email: string
    username: string
    avatar?: string
  }

  interface SecureSessionData {
    accessToken: string
    refreshToken: string
  }
}

export {}
