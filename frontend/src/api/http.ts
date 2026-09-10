// /api を基点にした共通 fetch ラッパ。
// JSON の送受信と、バックエンドのエラー形式 { errors: string[] } を型付きの例外に変換する。

const BASE_URL = '/api'

// バックエンドが 422 / 404 等で返すエラーボディ
interface ApiErrorBody {
  errors?: string[]
}

// API 呼び出しの失敗を表す例外。HTTP ステータスとメッセージ配列を保持する。
export class ApiError extends Error {
  readonly status: number
  readonly errors: string[]

  constructor(status: number, errors: string[]) {
    super(errors[0] ?? `API request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

interface RequestOptions {
  method?: string
  // 送信ボディ（JSON 化して送る）。GET/DELETE では省略。
  body?: unknown
  // クエリ文字列に載せるパラメータ（undefined / 空文字は除外）
  query?: Record<string, string | undefined>
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${BASE_URL}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    let errors: string[] = []
    try {
      const data = (await response.json()) as ApiErrorBody
      errors = data.errors ?? []
    } catch {
      // ボディが無い / JSON でない場合はステータスだけで例外化
    }
    throw new ApiError(response.status, errors)
  }

  // 204 No Content（削除など）はボディが無い
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
