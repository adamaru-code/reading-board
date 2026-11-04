// E2E を流す前に 1 回だけ動く：サーバーが動いているかを確かめ、E2E 専用のアカウントを作り直す
import { randomBytes } from 'node:crypto'
import { DESTROY_E2E_USERS, E2E_EMAIL, railsRunner } from './support'

async function checkServers() {
  const hint = [
    'E2E の前に、3 つのサーバーを起動してください（README の「ローカル起動」）：',
    '  docker compose up -d                  # MySQL（3306）',
    '  cd backend && bin/rails server        # Rails（3000）',
    '  cd frontend && npm run dev            # Vite（5173）',
  ].join('\n')
  try {
    // Vite（5173）の画面と、Vite を通した Rails（3000）の API。ログインしていないので API は 401 が正しい
    const page = await fetch('http://localhost:5173/')
    const api = await fetch('http://localhost:5173/api/session')
    if (!page.ok || api.status !== 401) throw new Error(`画面 ${page.status}・API ${api.status}`)
  } catch (e) {
    throw new Error(`サーバーにつながりません（${(e as Error).message}）\n${hint}`)
  }
}

export default async function globalSetup() {
  await checkServers()
  // パスワードは流すたびに作り直す。テスト（別の作業者のプロセス）へは環境変数で渡す
  const password = randomBytes(16).toString('hex')
  railsRunner(
    `ActiveRecord::Base.transaction do
       ${DESTROY_E2E_USERS}
       User.create!(email: "${E2E_EMAIL}", password: ENV.fetch("E2E_PASSWORD"), admin: true)
     end`,
    { E2E_PASSWORD: password },
  )
  process.env.E2E_PASSWORD = password
}
