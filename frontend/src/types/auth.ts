// ログイン中のユーザー（Api::SessionsController の JSON 契約に一致）
export interface User {
  id: number
  email: string
}
