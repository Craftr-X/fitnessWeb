/**
 * e2e 专用 Supabase 替身（T6）。
 *
 * 只实现 FitUp 真正用到的端点，不连真实 Supabase、不发真实邮件：
 *   POST /auth/v1/otp      接受任意邮箱
 *   POST /auth/v1/verify   接受任意 6 位验证码，返回可持久化的合法 session
 *   GET  /auth/v1/user     返回当前用户（SDK 刷新会话时用）
 *   POST /auth/v1/token    refresh_token 换 session
 *   POST /auth/v1/logout   退出
 *   GET  /rest/v1/user_data 无数据必须返回 `200 []`（配合 .limit(1)，不能返回 406）
 *   POST /rest/v1/user_data upsert 整份文档
 *   DELETE /rest/v1/user_data
 *   POST /__reset          清空内存与 data.json，供每个用例前置清理
 *   GET  /__health         webServer 就绪探针
 *
 * 数据落在内存，同时镜像到 e2e/data.json 便于本地调试（已加入 .gitignore）。
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.E2E_MOCK_PORT ?? 54321)
const DATA_FILE = join(dirname(fileURLToPath(import.meta.url)), 'data.json')
const DEFAULT_EMAIL = 'e2e@example.com'

/** user_id -> { user_id, data, updated_at } */
let rows = new Map()
/** email -> user 对象 */
const users = new Map()

function restore() {
  try {
    if (existsSync(DATA_FILE)) {
      rows = new Map(Object.entries(JSON.parse(readFileSync(DATA_FILE, 'utf8'))))
    }
  } catch {
    rows = new Map()
  }
}
function persist() {
  writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(rows), null, 2))
}
restore()

function userIdFor(email) {
  const hex = createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function userFor(email) {
  const key = email.trim().toLowerCase()
  if (!users.has(key)) {
    const now = new Date().toISOString()
    users.set(key, {
      id: userIdFor(key),
      aud: 'authenticated',
      role: 'authenticated',
      email: key,
      email_confirmed_at: now,
      confirmed_at: now,
      created_at: now,
      last_sign_in_at: now,
      updated_at: now,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
    })
  }
  return users.get(key)
}

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

/** 生成结构合法的 JWT（SDK 会解析 exp/sub/email），签名部分不校验 */
function sessionFor(email) {
  const key = email.trim().toLowerCase()
  const now = Math.floor(Date.now() / 1000)
  const user = userFor(key)
  const accessToken = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: user.id, aud: 'authenticated', role: 'authenticated', email: key, iat: now, exp: now + 3600 }),
    'e2e-signature',
  ].join('.')
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `e2e-refresh.${Buffer.from(key).toString('base64url')}`,
    user,
  }
}

function userFromAuth(req) {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'))
    return userFor(payload.email ?? DEFAULT_EMAIL)
  } catch {
    return userFor(DEFAULT_EMAIL)
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}
function sendEmpty(res, status = 204) {
  res.writeHead(status)
  res.end()
}
async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
  const pathname = url.pathname

  // 前端在 3100、后端在 54321，跨域 + 自定义头（apikey / Authorization / Prefer）必须放行预检
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  // 回显浏览器预检声明的头：SDK 升级可能新增请求头，硬编码白名单会漏
  const requestedHeaders = req.headers['access-control-request-headers']
  res.setHeader(
    'Access-Control-Allow-Headers',
    requestedHeaders ||
      'apikey,authorization,content-type,accept,prefer,x-client-info,x-supabase-api-version',
  )
  res.setHeader('Access-Control-Expose-Headers', '*')
  if (req.method === 'OPTIONS') return sendEmpty(res, 204)

  const body = await readJson(req)

  if (pathname === '/__health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, users: users.size, rows: rows.size })
  }
  if (pathname === '/__state' && req.method === 'GET') {
    // 供 waitForCloudSync 轮询：确认引导后的文档已落盘再刷新页面
    return sendJson(res, 200, { rows: Object.fromEntries(rows) })
  }
  if (pathname === '/__reset' && req.method === 'POST') {
    rows = new Map()
    users.clear()
    if (existsSync(DATA_FILE)) unlinkSync(DATA_FILE)
    return sendJson(res, 200, { ok: true })
  }

  // ---- GoTrue (auth) ----
  if (pathname === '/auth/v1/otp' && req.method === 'POST') {
    userFor(body.email ?? DEFAULT_EMAIL)
    return sendJson(res, 200, {})
  }
  if (pathname === '/auth/v1/verify' && req.method === 'POST') {
    return sendJson(res, 200, sessionFor(body.email ?? DEFAULT_EMAIL))
  }
  if (pathname === '/auth/v1/token' && req.method === 'POST') {
    let email = DEFAULT_EMAIL
    const refresh = String(body.refresh_token ?? '')
    if (refresh.startsWith('e2e-refresh.')) {
      try {
        email = Buffer.from(refresh.slice('e2e-refresh.'.length), 'base64url').toString('utf8')
      } catch {
        // 保持默认邮箱
      }
    }
    return sendJson(res, 200, sessionFor(email))
  }
  if (pathname === '/auth/v1/user' && req.method === 'GET') {
    return sendJson(res, 200, userFromAuth(req))
  }
  if (pathname === '/auth/v1/logout' && req.method === 'POST') {
    return sendEmpty(res, 204)
  }
  // SDK 可能探测 settings / health 等端点，统一给空成功，避免把冒烟测试卡在无关请求上
  if (pathname.startsWith('/auth/v1/') && req.method === 'GET') {
    return sendJson(res, 200, {})
  }

  // ---- PostgREST (user_data) ----
  if (pathname === '/rest/v1/user_data') {
    const rawUserId = url.searchParams.get('user_id') ?? ''
    const userId = rawUserId.startsWith('eq.') ? rawUserId.slice(3) : userIdFor(DEFAULT_EMAIL)

    if (req.method === 'GET') {
      // 关键：无数据返回 200 []，不是 406/PGRST116 —— 后者会被当成读取失败
      const row = rows.get(userId)
      return sendJson(res, 200, row ? [{ data: row.data }] : [])
    }
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const items = Array.isArray(body) ? body : [body]
      for (const item of items) {
        const id = item.user_id ?? userId
        rows.set(id, {
          user_id: id,
          data: item.data ?? {},
          updated_at: item.updated_at ?? new Date().toISOString(),
        })
      }
      persist()
      return sendJson(res, 201, [])
    }
    if (req.method === 'DELETE') {
      rows.delete(userId)
      persist()
      return sendEmpty(res, 204)
    }
  }

  console.warn(`[mock-supabase] 未处理的请求：${req.method} ${pathname}`)
  return sendJson(res, 404, { message: 'mock-supabase: not found', method: req.method, path: pathname })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-supabase] listening on http://127.0.0.1:${PORT}`)
})
