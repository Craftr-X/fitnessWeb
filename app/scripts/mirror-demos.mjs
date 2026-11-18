/**
 * 从 MuscleWiki 下载 demos.ts 中 mw('...') 引用的视频，可选 ffmpeg 压缩，上传到 Supabase Storage。
 * 需要环境变量：VITE_SUPABASE_URL（或 SUPABASE_URL）、SUPABASE_SERVICE_ROLE_KEY（禁止用 anon 上传）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, spawnSync } from 'node:child_process'

const MW_MEDIA_BASE = 'https://media.musclewiki.com/media/uploads/videos/branded'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))

const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '')
  .trim()
  .replace(/\/$/, '')
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!serviceRoleKey) {
  console.error(
    '缺少 SUPABASE_SERVICE_ROLE_KEY。上传必须使用 service role，禁止用 VITE_SUPABASE_ANON_KEY。',
  )
  process.exit(1)
}

if (anonKey && serviceRoleKey === anonKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY 与 VITE_SUPABASE_ANON_KEY 相同，拒绝上传。')
  process.exit(1)
}

if (!supabaseUrl) {
  console.error('缺少 VITE_SUPABASE_URL 或 SUPABASE_URL。')
  process.exit(1)
}

const demosPath = path.join(scriptDir, '../src/lib/demos.ts')
const src = fs.readFileSync(demosPath, 'utf8')
const keys = new Set()
for (const m of src.matchAll(/mw\(([^)]*)\)/g)) {
  for (const k of m[1].matchAll(/'([^']+)'/g)) keys.add(k[1])
}

if (keys.size === 0) {
  console.error('未在 demos.ts 中解析到任何 mw(...) 视频 key。')
  process.exit(1)
}

const rawDir = path.join(scriptDir, '.demo-cache/raw')
const compressedDir = path.join(scriptDir, '.demo-cache/compressed')
fs.mkdirSync(rawDir, { recursive: true })
fs.mkdirSync(compressedDir, { recursive: true })

function ffmpegAvailable() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const useFfmpeg = ffmpegAvailable()
if (!useFfmpeg) {
  console.warn('未检测到 ffmpeg，将上传未压缩的原始 mp4。')
}

const ok = []
const fail = []

for (const key of [...keys].sort()) {
  try {
    const rawPath = path.join(rawDir, `${key}.mp4`)
    if (!fs.existsSync(rawPath)) {
      const res = await fetch(`${MW_MEDIA_BASE}/${encodeURIComponent(key)}.mp4`)
      if (!res.ok) throw new Error(`下载 HTTP ${res.status}`)
      fs.writeFileSync(rawPath, Buffer.from(await res.arrayBuffer()))
    }

    const outPath = path.join(compressedDir, `${key}.mp4`)
    if (useFfmpeg) {
      const run = spawnSync(
        'ffmpeg',
        [
          '-y',
          '-i',
          rawPath,
          '-vf',
          "scale=-2:'min(720,ih)'",
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '28',
          '-an',
          outPath,
        ],
        { stdio: 'pipe', encoding: 'utf8' },
      )
      if (run.status !== 0) {
        throw new Error(run.stderr?.slice(-500) || 'ffmpeg 失败')
      }
    } else if (!fs.existsSync(outPath)) {
      fs.copyFileSync(rawPath, outPath)
    }

    const body = fs.readFileSync(outPath)
    const uploadUrl = `${supabaseUrl}/storage/v1/object/exercise-demos/videos/${key}.mp4`
    const up = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'video/mp4',
        'x-upsert': 'true',
      },
      body,
    })
    if (!up.ok) {
      const detail = await up.text()
      throw new Error(`上传 HTTP ${up.status}: ${detail.slice(0, 200)}`)
    }
    ok.push(key)
    console.log(`ok  ${key}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    fail.push({ key, message })
    console.error(`fail ${key}: ${message}`)
  }
}

console.log(`\n完成: ${ok.length} 成功, ${fail.length} 失败（共 ${keys.size} 个 key）`)
process.exit(fail.length > 0 ? 1 : 0)