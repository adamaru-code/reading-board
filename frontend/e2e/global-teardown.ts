// E2E を流したあとに 1 回だけ動く：E2E 専用のアカウントを本ごと消す（開発用 DB に残さない）
import { E2E_EMAIL, railsRunner } from './support'

export default async function globalTeardown() {
  railsRunner(`User.find_by(email: "${E2E_EMAIL}")&.destroy!`)
}
