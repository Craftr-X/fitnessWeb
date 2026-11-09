import { describe, it, expect } from 'vitest'
import {
  CSV_BOM,
  csvCell,
  toCsv,
  weightsCsv,
  trainingCsv,
  checksCsv,
  csvFileName,
} from '@/lib/exportCsv'
import type { CheckMap, DayPlan, ExerciseLogMap, WeekPlan, WeightEntry } from '@/types'

/**
 * CSV 导出（T5）：Excel 双击直开 = UTF-8 BOM + CRLF；
 * 含 , " 换行的字段必须转义，null 写空。
 * 用 fromCharCode 构造控制字符，避免源码转义在各环境下的歧义。
 */
const CR = String.fromCharCode(13)
const LF = String.fromCharCode(10)
const CRLF = CR + LF

/** 去掉 BOM、按行拆开（末尾空行丢弃） */
function toLines(csv: string): string[] {
  return csv.replace(CSV_BOM, '').split(CRLF).slice(0, -1)
}

describe('csvCell', () => {
  it('普通文本与数字不转义', () => {
    expect(csvCell('哑铃卧推')).toBe('哑铃卧推')
    expect(csvCell(72.4)).toBe('72.4')
    expect(csvCell(3)).toBe('3')
  })

  it('含逗号、引号、换行时用双引号包裹，内部双引号翻倍', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('说"好"')).toBe('"说""好"""')
    expect(csvCell('第一行' + LF + '第二行')).toBe('"第一行' + LF + '第二行"')
    expect(csvCell('回' + CR + '车')).toBe('"回' + CR + '车"')
  })

  it('null / undefined 写空字符串', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })
})

describe('toCsv', () => {
  it('以 BOM 开头、每行以 CRLF 结尾', () => {
    const out = toCsv(['a', 'b'], [
      [1, 2],
      ['x', null],
    ])
    expect(out.startsWith(CSV_BOM)).toBe(true)
    expect(out.endsWith(CRLF)).toBe(true)
    expect(out).toBe(CSV_BOM + 'a,b' + CRLF + '1,2' + CRLF + 'x,' + CRLF)
  })
})

describe('weightsCsv', () => {
  it('空数组只输出表头', () => {
    expect(toLines(weightsCsv([], 178))).toEqual(['日期,时间,体重(kg),体脂(%),BMI'])
    // 整串也以 CRLF 结尾（表头行也是完整一行）
    expect(weightsCsv([], 178)).toBe(CSV_BOM + '日期,时间,体重(kg),体脂(%),BMI' + CRLF)
  })

  it('体脂为空写空；BMI 按身高计算', () => {
    const weights: WeightEntry[] = [
      { date: '2026-11-02', time: '07:30', weight: 72, bodyFat: null },
      { date: '2026-11-08', weight: 72.6, bodyFat: 15.2 },
    ]
    expect(toLines(weightsCsv(weights, 178))).toEqual([
      '日期,时间,体重(kg),体脂(%),BMI',
      '2026-11-02,07:30,72,,22.7',
      '2026-11-08,,72.6,15.2,22.9',
    ])
  })
})

describe('trainingCsv', () => {
  it('setLogs 展开为每组一行；自重组（weightKg=null）重量写空', () => {
    const setLogs: ExerciseLogMap = {
      平板支撑: [
        { date: '2026-11-04', week: 2, sets: [{ weightKg: null, reps: 60 }] },
      ],
      哑铃卧推: [
        {
          date: '2026-11-04',
          week: 2,
          sets: [
            { weightKg: 20, reps: 12 },
            { weightKg: 22.5, reps: 10 },
          ],
        },
      ],
    }
    expect(toLines(trainingCsv(setLogs))).toEqual([
      '日期,动作,组序,重量(kg),次数',
      // 同日按动作名排序，组序从 1 起；自重动作重量列留空
      '2026-11-04,哑铃卧推,1,20,12',
      '2026-11-04,哑铃卧推,2,22.5,10',
      '2026-11-04,平板支撑,1,,60',
    ])
  })

  it('空 setLogs 只输出表头', () => {
    expect(toLines(trainingCsv({}))).toEqual(['日期,动作,组序,重量(kg),次数'])
  })
})

describe('checksCsv', () => {
  const plan = (): WeekPlan => {
    const mk = (day: string, focus: string, names: string[]): DayPlan => ({
      day,
      focus,
      type: 'strength',
      exercises: names.map((name) => ({ name, sets: '3 组 × 8-12 次' })),
    })
    return {
      week: 2,
      startDate: '2026-11-02',
      days: [
        mk('周一', '胸', ['哑铃卧推', '哑铃飞鸟']),
        mk('周二', '背', ['哑铃划船']),
        { day: '周三', focus: '休息', type: 'rest', exercises: [] },
      ],
      adjustmentNote: '',
    }
  }
  const checks: CheckMap = { '2:0:0': true, '2:1:0': true }

  it('按整周计划展开：key 还原成日期、周几与动作名，未勾为「否」', () => {
    expect(toLines(checksCsv(plan(), checks))).toEqual([
      '日期,周几,动作,组次,是否完成',
      '2026-11-02,周一,哑铃卧推,3 组 × 8-12 次,是',
      '2026-11-02,周一,哑铃飞鸟,3 组 × 8-12 次,否',
      // di=1 → 日期 = startDate + 1 天；休息日不产生数据行
      '2026-11-03,周二,哑铃划船,3 组 × 8-12 次,是',
    ])
  })

  it('含逗号的组次被正确转义', () => {
    const p = plan()
    p.days[0].exercises[0].sets = '3 组, 共 12 次'
    expect(toLines(checksCsv(p, checks))[1]).toBe(
      '2026-11-02,周一,哑铃卧推,"3 组, 共 12 次",是',
    )
  })
})

describe('csvFileName', () => {
  it('形如 FitUp-体重-20261106.csv', () => {
    expect(csvFileName('体重', new Date('2026-11-06T10:00:00'))).toBe('FitUp-体重-20261106.csv')
    expect(csvFileName('训练记录', new Date('2026-11-06T23:59:59'))).toBe(
      'FitUp-训练记录-20261106.csv',
    )
    expect(csvFileName('打卡', new Date('2026-11-06T00:00:00'))).toBe('FitUp-打卡-20261106.csv')
  })
})
