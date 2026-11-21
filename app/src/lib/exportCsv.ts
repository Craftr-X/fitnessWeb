import { addDays, format } from 'date-fns'
import { bmi } from '@/lib/store'
import type { CheckMap, ExerciseLogMap, WeekPlan, WeightEntry } from '@/types'

/** Excel 双击直开：UTF-8 BOM + CRLF（无 BOM 时中文表头会乱码） */
export const CSV_BOM = '﻿'

/** 单字段转义：含 , " \r \n 时用双引号包裹，内部 " 变 ""；null/undefined 写空 */
export function csvCell(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

/** 组装整表：表头 + 行，行尾 \r\n，前置 BOM */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers, ...rows].map((cells) => cells.map(csvCell).join(','))
  return CSV_BOM + lines.join('\r\n') + '\r\n'
}

/** 体重记录表：日期, 时间, 体重(kg), 体脂(%), BMI */
export function weightsCsv(weights: WeightEntry[], heightCm: number): string {
  return toCsv(
    ['日期', '时间', '体重(kg)', '体脂(%)', 'BMI'],
    weights.map((w) => [
      w.date,
      w.time ?? '',
      w.weight,
      w.bodyFat != null ? w.bodyFat : '',
      w.weight > 0 && heightCm > 0 ? Number(bmi(w.weight, heightCm).toFixed(1)) : '',
    ]),
  )
}

/** 训练记录表：日期, 动作, 组序, 重量(kg), 次数。按日期/动作/组序排序（码点序，跨环境稳定）；自重组重量写空 */
export function trainingCsv(setLogs: ExerciseLogMap): string {
  const rows: (string | number | null)[][] = []
  for (const [name, records] of Object.entries(setLogs)) {
    for (const rec of records) {
      rec.sets.forEach((set, i) => {
        rows.push([rec.date, name, i + 1, set.weightKg, set.reps])
      })
    }
  }
  const key = (r: (string | number | null)[]) =>
    r[0] + '|' + r[1] + '|' + String(r[2]).padStart(3, '0')
  rows.sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
  return toCsv(['日期', '动作', '组序', '重量(kg)', '次数'], rows)
}

/** 本周打卡表：日期, 周几, 动作, 组次, 是否完成（按整周计划展开，未勾也是一行「否」） */
export function checksCsv(weekPlan: WeekPlan, checks: CheckMap): string {
  const monday = new Date(weekPlan.startDate + 'T00:00:00')
  const rows: (string | number | null)[][] = []
  weekPlan.days.forEach((day, di) => {
    day.exercises.forEach((ex, ei) => {
      rows.push([
        format(addDays(monday, di), 'yyyy-MM-dd'),
        day.day,
        ex.name,
        ex.sets,
        checks[`${weekPlan.week}:${di}:${ei}`] ? '是' : '否',
      ])
    })
  })
  return toCsv(['日期', '周几', '动作', '组次', '是否完成'], rows)
}

/** 触发浏览器下载（与 account.ts 的 downloadExport 同一模式） */
export function downloadCsv(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/** 文件名：FitUp-体重-20261106.csv */
export function csvFileName(kind: '体重' | '训练记录' | '打卡', today: Date = new Date()): string {
  return 'FitUp-' + kind + '-' + format(today, 'yyyyMMdd') + '.csv'
}
