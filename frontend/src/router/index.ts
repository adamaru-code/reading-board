// 画面の切り替え（vue-router）。URL と画面の対応表と、画面を移る前の確認（ナビゲーションガード）
import { createRouter, createWebHistory, type RouteRecordRaw, type RouterHistory } from 'vue-router'
import KanbanBoard from '../components/KanbanBoard.vue'
import LoginView from '../components/LoginView.vue'
import RegisterView from '../components/RegisterView.vue'
import ResetPasswordView from '../components/ResetPasswordView.vue'
import { currentUser, ensureAuthChecked } from '../lib/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean // ログインが必要（未ログインなら /login へ）
    guestOnly?: boolean // 未ログインの人だけ（ログイン済みなら / へ）
  }
}

const queryString = (value: unknown) => (typeof value === 'string' ? value : '')

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'board', component: KanbanBoard, meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true } },
  {
    // 招待リンク：/register?invite=<コード>（コード入力済みで登録画面を出す）
    path: '/register',
    name: 'register',
    component: RegisterView,
    meta: { guestOnly: true },
    props: (route) => ({ initialCode: queryString(route.query.invite) }),
  },
  {
    // 再設定リンク：/reset?token=<トークン>（ログイン状態に関係なく出す）
    path: '/reset',
    name: 'reset',
    component: ResetPasswordView,
    props: (route) => ({ token: queryString(route.query.token) }),
  },
  // 知らない URL はボードへ（未ログインならガードが /login へ回す）
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({ history, routes })

  router.beforeEach(async (to) => {
    // 今までに送ったリンク（/?invite=… /?reset=…）も使えるよう、新しい URL へ移す
    if (to.path === '/' && queryString(to.query.invite)) {
      return { name: 'register', query: { invite: to.query.invite }, replace: true }
    }
    if (to.path === '/' && queryString(to.query.reset)) {
      return { name: 'reset', query: { token: to.query.reset }, replace: true }
    }

    await ensureAuthChecked()
    if (to.meta.requiresAuth && !currentUser.value) return { name: 'login', replace: true }
    if (to.meta.guestOnly && currentUser.value) return { name: 'board', replace: true }
    return true
  })

  return router
}

export default createAppRouter()
