// E2E を流したあとに 1 回だけ動く：E2E が作ったアカウント（登録したアカウントも）を本ごと消す（開発用 DB に残さない）
import { DESTROY_E2E_USERS, railsRunner } from './support'

export default async function globalTeardown() {
  railsRunner(DESTROY_E2E_USERS)
}
