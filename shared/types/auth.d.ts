declare module '#auth-utils' {
  interface User {
    id: string
    role: import('./index').Role
    name: string
    email: string
    avatar?: string
  }
}

export {}
