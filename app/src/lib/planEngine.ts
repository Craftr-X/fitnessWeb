/**
 * 个性化计划规则引擎（v2）。
 *
 * 与 lib/store.ts 里的 buildWeekPlan(week, difficulty) 并存：
 * - buildWeekPlan 是老用户的"增肌 + 羽毛球"固定模板，签名/输出保持不变（store.test.ts 锁定）。
 * - 本模块 buildWeekPlanFromProfile 根据用户 onboarding 画像生成差异化计划，
 *   供新用户首次进入和老用户"重新定制"使用。
 *
 * 设计原则：纯函数、模块化拆分、复用同一套渐进超负荷逻辑，day.type 只用
 * WeeklyPlan.tsx 已支持的 4 种（strength/sport/rest/recovery），避免渲染崩。
 */
import { addDays, format, startOfWeek } from 'date-fns'
import type {
  DayPlan,
  Equipment,
  Exercise,
  Experience,
  LoadType,
  Profile,
  Sport,
  WeekFeedback,
  WeekPlan,
  WeightGoal,
} from '@/types'
// currentMonday/buildWeekPlan 复用 store 实现，避免双份维护；同时 re-export 保持本模块 API 稳定
import { buildWeekPlan, currentMonday, WEIGHT_GOAL_LABEL } from '@/lib/store'
export { currentMonday }

/* ------------------------------------------------------------------ */
/* 渐进超负荷参数（与 store.buildWeekPlan 同策略，独立实现以便单独演进）*/
/* ------------------------------------------------------------------ */

interface Progression {
  /** 次数进阶量 */
  extra: number
  /** 是否在基础组数上 +1 组 */
  addSet: boolean
  /** 本周调整说明 */
  note: string
  /** 反馈触发的组数上限偏移（负=降量，在常规封顶之后再叠加，不低于 2 组） */
  setCapDelta?: number
}

/**
 * 根据周数 + 上周难度反馈，计算渐进超负荷参数。
 * 每 2 周一个台阶，次数 +step（上限 4）；week>=5 且不太难则组数 +1。
 */
export function computeProgression(week: number, difficulty?: number): Progression {
  const step = Math.min(Math.floor((week - 1) / 2), 4)
  let extra = step
  let note = `第 ${week} 周：在前一阶段基础上动作次数 +${step}（渐进超负荷）。`
  if (difficulty !== undefined) {
    if (difficulty >= 4) {
      extra = Math.max(0, step - 1)
      note = `上周反馈偏难（${difficulty}/5），本周降低进阶幅度，先把动作做标准。`
    } else if (difficulty <= 2) {
      extra = step + 1
      note = `上周反馈较轻松（${difficulty}/5），本周适度加量，可以试试更重的负重。`
    } else {
      note = `上周难度适中（${difficulty}/5），本周按计划正常进阶（次数 +${step}）。`
    }
  }
  const addSet = week >= 5 && (difficulty === undefined || difficulty <= 3)
  return { extra, addSet, note }
}

/* ------------------------------------------------------------------ */
/* 肌群分配：按训练天数 + 是否有专项运动，决定每天练什么               */
/* ------------------------------------------------------------------ */

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulder'
  | 'arms'
  | 'legs'
  | 'core'
  | 'push'
  | 'pull'
  | 'fullbody'

/**
 * 按训练天数分配每日主练肌群。有专项运动时减少腿日（运动日覆盖下肢）。
 * 返回长度等于 trainDays 的肌群数组，顺序即周一→周日的训练日顺序。
 */
export function splitMuscleGroups(trainDays: number, hasSport: boolean): MuscleGroup[] {
  const clamped = Math.min(Math.max(trainDays, 2), 6)
  switch (clamped) {
    case 2:
      return ['fullbody', 'fullbody']
    case 3:
      // 有运动 → 上肢为主，避免专项日前后腿酸
      return hasSport ? ['push', 'pull', 'core'] : ['push', 'pull', 'legs']
    case 4:
      return hasSport ? ['chest', 'back', 'shoulder', 'core'] : ['chest', 'back', 'shoulder', 'legs']
    case 5:
      return ['chest', 'back', 'shoulder', 'arms', 'legs']
    case 6:
    default:
      return ['chest', 'back', 'shoulder', 'arms', 'legs', 'core']
  }
}

/* ------------------------------------------------------------------ */
/* 动作池：按肌群 + 器械，返回候选动作                                  */
/* ------------------------------------------------------------------ */

interface ExerciseSeed {
  name: string
  /** 基础次数下界（次数类动作）或秒数（时间类动作） */
  baseLo: number
  baseHi: number
  /** 时间类（平板支撑等），sets 字符串用秒数而不是次数 */
  timed?: boolean
  /** 固定组数倍率：1=正常（受 addSet 影响），0=不受 addSet 影响（如热身/拉伸） */
  setTier?: 0 | 1
  /**
   * 负荷类型覆盖：缺省时按 timed → 'timed'、器械 none → 'bodyweight'、其余 → 'weighted' 推断。
   * 健身房池里的自重动作（引体向上、悬垂举腿等）需显式标 'bodyweight'。
   */
  loadType?: LoadType
  note?: string
}

const POOL: Record<MuscleGroup, Partial<Record<Equipment, ExerciseSeed[]>>> = {
  chest: {
    none: [
      { name: '俯卧撑（跪姿可退阶）', baseLo: 8, baseHi: 12, note: '胸触地、核心收紧' },
      { name: '上斜俯卧撑（手撑床沿/凳子）', baseLo: 10, baseHi: 12, note: '练上胸' },
      { name: '毛巾飞鸟', baseLo: 12, baseHi: 15, note: '感受胸部挤压' },
    ],
    dumbbell: [
      { name: '哑铃卧推（地板/凳子）', baseLo: 8, baseHi: 12, note: '全幅度、控制下放' },
      { name: '哑铃上斜卧推', baseLo: 10, baseHi: 12, note: '练上胸' },
      { name: '哑铃飞鸟', baseLo: 12, baseHi: 15, note: '轻重量、感受挤压' },
    ],
    gym: [
      { name: '杠铃卧推', baseLo: 8, baseHi: 12, note: '全幅度、有保护' },
      { name: '上斜哑铃卧推', baseLo: 10, baseHi: 12 },
      { name: '绳索飞鸟 / 蝴蝶机', baseLo: 12, baseHi: 15 },
    ],
  },
  back: {
    none: [
      { name: '俯卧 Y-T-W 抬起（练上背）', baseLo: 10, baseHi: 12, note: '改善圆肩' },
      { name: '超人式（练下背）', baseLo: 12, baseHi: 15 },
      { name: '反向雪天使', baseLo: 12, baseHi: 15 },
    ],
    dumbbell: [
      { name: '单臂哑铃划船', baseLo: 10, baseHi: 12, note: '可用装满水的水瓶替代' },
      { name: '俯身哑铃划船', baseLo: 12, baseHi: 15 },
      { name: '俯身哑铃反向飞鸟（后束）', baseLo: 12, baseHi: 15, note: '改善体态' },
    ],
    gym: [
      { name: '引体向上（可弹力带辅助）', baseLo: 6, baseHi: 10, loadType: 'bodyweight' },
      { name: '高位下拉', baseLo: 10, baseHi: 12 },
      { name: '杠铃划船', baseLo: 10, baseHi: 12 },
    ],
  },
  shoulder: {
    none: [
      { name: '折刀俯卧撑（练肩）', baseLo: 8, baseHi: 12 },
      { name: '侧平举（装水水瓶）', baseLo: 12, baseHi: 15, note: '小重量、慢速、到肩高' },
      { name: '靠墙倒立撑（进阶）', baseLo: 6, baseHi: 10 },
    ],
    dumbbell: [
      { name: '哑铃肩上推举', baseLo: 10, baseHi: 12, note: '可坐椅子上做' },
      { name: '哑铃侧平举', baseLo: 12, baseHi: 15, note: '小重量多次数' },
      { name: '俯身哑铃侧平举（后束）', baseLo: 12, baseHi: 15 },
    ],
    gym: [
      { name: '杠铃/哑铃肩上推举', baseLo: 8, baseHi: 12 },
      { name: '哑铃侧平举', baseLo: 12, baseHi: 15 },
      { name: '反向飞鸟（后束）', baseLo: 12, baseHi: 15 },
    ],
  },
  arms: {
    none: [
      { name: '凳上臂屈伸（练三头）', baseLo: 10, baseHi: 12, note: '瘦手臂先练它' },
      { name: '毛巾弯举（等长收缩）', baseLo: 12, baseHi: 15 },
      { name: '窄距俯卧撑（练三头）', baseLo: 8, baseHi: 12 },
    ],
    dumbbell: [
      { name: '哑铃弯举', baseLo: 12, baseHi: 15 },
      { name: '哑铃颈后臂屈伸（三头）', baseLo: 10, baseHi: 12 },
      { name: '锤式弯举', baseLo: 12, baseHi: 15 },
    ],
    gym: [
      { name: '杠铃弯举', baseLo: 10, baseHi: 12 },
      { name: '绳索下压（三头）', baseLo: 12, baseHi: 15 },
      { name: '牧师椅弯举', baseLo: 10, baseHi: 12 },
    ],
  },
  legs: {
    none: [
      { name: '徒手深蹲', baseLo: 15, baseHi: 20, note: '膝盖沿脚尖方向' },
      { name: '弓步蹲（每侧）', baseLo: 10, baseHi: 12 },
      { name: '臀桥', baseLo: 15, baseHi: 20, note: '顶峰收紧臀部' },
    ],
    dumbbell: [
      { name: '哑铃高脚杯深蹲', baseLo: 10, baseHi: 12 },
      { name: '哑铃弓步蹲（每侧）', baseLo: 10, baseHi: 12 },
      { name: '哑铃罗马尼亚硬拉（练后链）', baseLo: 10, baseHi: 12 },
    ],
    gym: [
      { name: '杠铃深蹲', baseLo: 8, baseHi: 10, note: '核心收紧、有保护' },
      { name: '腿举', baseLo: 10, baseHi: 12 },
      { name: '罗马尼亚硬拉', baseLo: 10, baseHi: 12 },
    ],
  },
  core: {
    none: [
      { name: '平板支撑', baseLo: 45, baseHi: 60, timed: true },
      { name: '卷腹', baseLo: 15, baseHi: 20 },
      { name: '死虫式（练核心稳定）', baseLo: 10, baseHi: 12 },
    ],
    dumbbell: [
      { name: '平板支撑', baseLo: 45, baseHi: 60, timed: true },
      { name: '负重卷腹', baseLo: 15, baseHi: 20 },
      { name: '俄罗斯转体（持哑铃）', baseLo: 15, baseHi: 20 },
    ],
    gym: [
      { name: '悬垂举腿', baseLo: 10, baseHi: 12, loadType: 'bodyweight' },
      { name: '绳索卷腹', baseLo: 15, baseHi: 20 },
      { name: '平板支撑', baseLo: 45, baseHi: 60, timed: true },
    ],
  },
  push: {
    none: [
      { name: '俯卧撑（跪姿可退阶）', baseLo: 8, baseHi: 12 },
      { name: '凳上臂屈伸（练三头）', baseLo: 10, baseHi: 12 },
      { name: '折刀俯卧撑（练肩）', baseLo: 8, baseHi: 12 },
    ],
    dumbbell: [
      { name: '哑铃卧推', baseLo: 8, baseHi: 12 },
      { name: '哑铃肩上推举', baseLo: 10, baseHi: 12 },
      { name: '哑铃三头臂屈伸', baseLo: 10, baseHi: 12 },
    ],
    gym: [
      { name: '杠铃卧推', baseLo: 8, baseHi: 12 },
      { name: '肩上推举', baseLo: 8, baseHi: 12 },
      { name: '绳索下压（三头）', baseLo: 12, baseHi: 15 },
    ],
  },
  pull: {
    none: [
      { name: '俯卧 Y-T-W 抬起（练上背）', baseLo: 10, baseHi: 12 },
      { name: '超人式（练下背）', baseLo: 12, baseHi: 15 },
      { name: '反向雪天使', baseLo: 12, baseHi: 15 },
    ],
    dumbbell: [
      { name: '单臂哑铃划船', baseLo: 10, baseHi: 12 },
      { name: '哑铃弯举', baseLo: 12, baseHi: 15 },
      { name: '俯身哑铃反向飞鸟（后束）', baseLo: 12, baseHi: 15 },
    ],
    gym: [
      { name: '引体向上（可弹力带辅助）', baseLo: 6, baseHi: 10, loadType: 'bodyweight' },
      { name: '高位下拉', baseLo: 10, baseHi: 12 },
      { name: '杠铃划船', baseLo: 10, baseHi: 12 },
    ],
  },
  fullbody: {
    none: [
      { name: '徒手深蹲', baseLo: 15, baseHi: 20 },
      { name: '俯卧撑（跪姿可退阶）', baseLo: 8, baseHi: 12 },
      { name: '俯卧 Y-T-W 抬起（练上背）', baseLo: 10, baseHi: 12 },
      { name: '平板支撑', baseLo: 45, baseHi: 60, timed: true },
    ],
    dumbbell: [
      { name: '哑铃高脚杯深蹲', baseLo: 10, baseHi: 12 },
      { name: '哑铃卧推', baseLo: 8, baseHi: 12 },
      { name: '单臂哑铃划船', baseLo: 10, baseHi: 12 },
      { name: '哑铃肩上推举', baseLo: 10, baseHi: 12 },
    ],
    gym: [
      { name: '杠铃深蹲', baseLo: 8, baseHi: 10 },
      { name: '杠铃卧推', baseLo: 8, baseHi: 12 },
      { name: '引体向上 / 高位下拉', baseLo: 8, baseHi: 12, loadType: 'bodyweight' },
      { name: '肩上推举', baseLo: 8, baseHi: 12 },
    ],
  },
}

const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: '胸 + 三头',
  back: '背 + 二头',
  shoulder: '肩',
  arms: '手臂（二头 + 三头）',
  legs: '腿 + 臀',
  core: '核心',
  push: '推（胸 / 肩 / 三头）',
  pull: '拉（背 / 二头）',
  fullbody: '全身',
}

const GROUP_TIP: Record<MuscleGroup, string> = {
  chest: '增肌重点日。俯卧撑若太轻松，把脚垫高或背个小书包负重。',
  back: '背是上身视觉宽度的关键。没有单杠就用哑铃划船替代引体。',
  shoulder: '宽肩能让上身立刻显壮。侧平举用小重量多次数效果最好。',
  arms: '手臂日专注二头和三头，动作放慢、感受肌肉收缩。',
  legs: '下肢是全身力量的根基。深蹲注意膝盖沿脚尖方向，核心收紧。',
  core: '核心稳定是所有动作的基础。注意呼吸，不要憋气。',
  push: '推的动作一次性练到胸、肩、三头，效率高。',
  pull: '拉的动作练背和二头，改善久坐圆肩体态。',
  fullbody: '全身训练日，每个大肌群都照顾到，适合训练频率低的安排。',
}

/** 按器械选动作池；缺器械时回退到 none（徒手）。 */
function poolFor(group: MuscleGroup, equipment: Equipment): ExerciseSeed[] {
  return POOL[group][equipment] ?? POOL[group].none ?? []
}

/* ------------------------------------------------------------------ */
/* 目标调节：增肌/减脂/塑形/保持 → 次数区间与组数偏移                 */
/* ------------------------------------------------------------------ */

export interface GoalTuning {
  /** 次数区间整体偏移（正=加次数，负=减次数） */
  repOffset: number
  /** 组数额外偏移（受 addSet 之后再叠加） */
  setOffset: number
  /** 目标导向的 tip */
  tip: string
}

export function tuneByGoal(goal: WeightGoal): GoalTuning {
  switch (goal) {
    case 'gain':
      return { repOffset: 0, setOffset: 0, tip: '增肌：8-12 次为主，组间休息 60-90 秒，重量逐步上涨。' }
    case 'lose':
      // 减脂：次数偏高、组数偏少、配合循环短休息
      return { repOffset: 3, setOffset: -1, tip: '减脂：次数偏高、组间休息缩短到 30-45 秒，配合热量缺口。' }
    case 'recomp':
      return { repOffset: 1, setOffset: 0, tip: '塑形：10-12 次区间，兼顾增肌与减脂，动作质量优先。' }
    case 'maintain':
    default:
      return { repOffset: 0, setOffset: 0, tip: '保持：维持当前强度即可，重在坚持。' }
  }
}

/* ------------------------------------------------------------------ */
/* 伤病过滤：替换/移除会刺激伤部的动作                                 */
/* ------------------------------------------------------------------ */

/** 判断动作是否需要因伤病调整 */
function shouldFilterByInjury(name: string, injuries: string[] | undefined): boolean {
  if (!injuries || injuries.length === 0) return false
  // 含"膝盖"伤：移除深蹲/弓步/跳跃类
  if (injuries.some((i) => i.includes('膝')) && /(深蹲|弓步|跳|蹲)/.test(name)) return true
  // 含"肩"伤：移除过头推举/倒立
  if (injuries.some((i) => i.includes('肩')) && /(推举|倒立|折刀)/.test(name)) return true
  // 含"腰/下背"伤：移除硬拉/超人式
  if (
    injuries.some((i) => /腰|下背/.test(i)) &&
    /(硬拉|超人|罗马尼亚)/.test(name)
  )
    return true
  return false
}

/** 伤病对应的替代动作（按伤病关键词） */
const INJURY_SUBSTITUTES: { keyword: RegExp; group: MuscleGroup; seed: ExerciseSeed }[] = [
  {
    keyword: /膝/,
    group: 'legs',
    seed: { name: '靠墙静蹲', baseLo: 30, baseHi: 45, timed: true, note: '护膝替代动作' },
  },
  {
    keyword: /肩/,
    group: 'shoulder',
    seed: { name: '轻量侧平举（小幅度）', baseLo: 12, baseHi: 15, note: '肩部不适时降阶' },
  },
]

/** 对一个肌群的动作池做伤病过滤 + 补充替代动作，保证池不为空 */
export function filterByInjury(
  group: MuscleGroup,
  pool: ExerciseSeed[],
  injuries: string[] | undefined,
): ExerciseSeed[] {
  if (!injuries || injuries.length === 0) return pool
  let filtered = pool.filter((s) => !shouldFilterByInjury(s.name, injuries))
  // 若被过滤干净，保留原池（宁可有动作也不留空）
  if (filtered.length === 0) filtered = pool
  // 注入匹配的替代动作：用 substitute 自身的 group + keyword 对齐，避免跨肌群污染
  for (const sub of INJURY_SUBSTITUTES) {
    if (group === sub.group && injuries.some((i) => sub.keyword.test(i))) {
      filtered = [sub.seed, ...filtered.filter((s) => s.name !== sub.seed.name)]
    }
  }
  return filtered
}

/* ------------------------------------------------------------------ */
/* 把 ExerciseSeed + 渐进参数 + 目标调节 → 最终 Exercise              */
/* ------------------------------------------------------------------ */

function seedToExercise(
  seed: ExerciseSeed,
  p: Progression,
  tuning: GoalTuning,
  experience: Experience,
  equipment: Equipment,
): Exercise {
  // 热身/拉伸类（setTier=0）保持原样，不进阶
  if (seed.setTier === 0) {
    return { name: seed.name, sets: `${seed.baseLo} 分钟`, note: seed.note }
  }
  // 负荷类型：显式标注优先；否则时间类 → timed，徒手池 → bodyweight，哑铃/健身房池 → weighted
  const loadType: LoadType =
    seed.loadType ?? (seed.timed ? 'timed' : equipment === 'none' ? 'bodyweight' : 'weighted')
  if (seed.timed) {
    const secs = seed.baseLo + p.extra * 5
    const secsHi = seed.baseHi + p.extra * 5
    const sets = Math.max(2, (p.addSet ? 4 : 3) + (p.setCapDelta ?? 0))
    return { name: seed.name, sets: `${sets} 组 × ${secs}-${secsHi} 秒`, note: seed.note, loadType }
  }
  const lo = Math.max(5, seed.baseLo + p.extra + tuning.repOffset)
  const hi = Math.max(lo + 2, seed.baseHi + p.extra + tuning.repOffset)
  let sets = (p.addSet ? 4 : 3) + tuning.setOffset
  // 新手保护：组数不低于 2，避免一开始就上量太大
  if (experience === 'beginner') sets = Math.min(sets, 3)
  // 反馈触发的降量在常规封顶后再叠加（完成度低时组数上限 -1），保底 2 组
  sets = Math.max(2, sets + (p.setCapDelta ?? 0))
  return { name: seed.name, sets: `${sets} 组 × ${lo}-${hi} 次`, note: seed.note, loadType }
}

/* ------------------------------------------------------------------ */
/* 日类型构造器                                                        */
/* ------------------------------------------------------------------ */

const WARMUP: Exercise = { name: '热身：开合跳 + 目标肌群动态拉伸', sets: '5 分钟' }
const STRETCH_PREFIX: Record<MuscleGroup, string> = {
  chest: '胸部 + 三头',
  back: '背部 + 二头',
  shoulder: '肩部',
  arms: '手臂',
  legs: '腿部',
  core: '核心',
  push: '上肢',
  pull: '上肢',
  fullbody: '全身',
}

function buildStrengthDay(
  dayName: string,
  group: MuscleGroup,
  equipment: Equipment,
  experience: Experience,
  p: Progression,
  tuning: GoalTuning,
  injuries: string[] | undefined,
): DayPlan {
  const pool = filterByInjury(group, poolFor(group, equipment), injuries)
  const main = pool.map((seed) => seedToExercise(seed, p, tuning, experience, equipment))
  const stretch: Exercise = { name: `${STRETCH_PREFIX[group]}静态拉伸`, sets: '3 分钟' }
  return {
    day: dayName,
    focus: GROUP_LABEL[group],
    type: 'strength',
    tip: `${GROUP_TIP[group]} ${tuning.tip}`,
    exercises: [WARMUP, ...main, stretch],
  }
}

const SPORT_META: Record<Exclude<Sport, 'none'>, { name: string; warmup: string; tip: string }> = {
  badminton: {
    name: '羽毛球',
    warmup: '动态热身（重点踝关节、肩、手腕）',
    tip: '高强度对抗已充分锻炼下肢与心肺，当天注意补水和碳水。',
  },
  running: {
    name: '跑步',
    warmup: '动态热身（重点髋关节、踝关节、小腿）',
    tip: '注意配速和心率，跑后认真拉伸小腿和髂腰肌。',
  },
  cycling: {
    name: '骑行',
    warmup: '动态热身（重点膝关节、髋关节）',
    tip: '调整好座椅高度，注意踩踏节奏，避免膝盖内扣。',
  },
}

function buildSportDay(dayName: string, sport: Exclude<Sport, 'none'>, hours: number): DayPlan {
  const meta = SPORT_META[sport]
  return {
    day: dayName,
    focus: `${meta.name}日（${hours} 小时）`,
    type: 'sport',
    tip: meta.tip,
    exercises: [
      { name: meta.warmup, sets: '10 分钟' },
      { name: `${meta.name}训练 / 对抗`, sets: `${hours} 小时`, note: '中途每 30-40 分钟补水' },
      { name: '赛后静态拉伸', sets: '10 分钟' },
    ],
  }
}

function buildRestDay(dayName: string, isRecap = false): DayPlan {
  return {
    day: dayName,
    focus: isRecap ? '完全休息 + 本周复盘' : '休息 / 主动恢复',
    type: 'rest',
    tip: isRecap
      ? '睡够 7-9 小时。记得称体重、填写本周反馈，然后生成下周计划。'
      : '肌肉在休息时生长。散步 20-30 分钟 + 全身拉伸即可。',
    exercises: isRecap
      ? [
          { name: '充足睡眠', sets: '7-9 小时' },
          { name: '填写本周反馈 & 生成下周计划', sets: '在「每周反馈」页完成' },
        ]
      : [
          { name: '散步或轻松骑车', sets: '20-30 分钟' },
          { name: '全身拉伸', sets: '10 分钟' },
        ],
  }
}

/* ------------------------------------------------------------------ */
/* 主入口：按 profile 生成一周计划                                     */
/* ------------------------------------------------------------------ */

/**
 * 把训练日 + 专项运动日 + 休息日组装成完整 7 天。
 * 策略：训练日尽量均匀分布；专项运动日（如有）放在周六；其余为休息日；周日固定复盘。
 */
export function assembleWeek(
  groups: MuscleGroup[],
  opts: {
    equipment: Equipment
    experience: Experience
    progression: Progression
    tuning: GoalTuning
    injuries?: string[]
    sport?: Sport
    sportHours?: number
  },
): DayPlan[] {
  const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const days: DayPlan[] = Array.from({ length: 7 }, () => buildRestDay(''))
  const trainCount = groups.length
  const hasSport = opts.sport && opts.sport !== 'none' && (opts.sportHours ?? 0) > 0

  // 训练日分布：尽量间隔，避免连续大强度
  // 训练数 2 → 周一、周四；3 → 周一、三、五；4 → 一、二、四、五；5 → 一二三四五；6 → 一二三四五六
  const trainSlots: number[] = (
    {
      2: [0, 3],
      3: [0, 2, 4],
      4: [0, 1, 3, 4],
      5: [0, 1, 2, 3, 4],
      6: [0, 1, 2, 3, 4, 5],
    } as Record<number, number[]>
  )[trainCount] ?? [0]

  groups.forEach((group, i) => {
    const slot = trainSlots[i] ?? i
    days[slot] = buildStrengthDay(
      DAY_NAMES[slot],
      group,
      opts.equipment,
      opts.experience,
      opts.progression,
      opts.tuning,
      opts.injuries,
    )
  })

  // 专项运动日放周六（slot 5），若周六已被训练日占用则后移或覆盖
  if (hasSport) {
    days[5] = buildSportDay(DAY_NAMES[5], opts.sport as Exclude<Sport, 'none'>, opts.sportHours ?? 1)
  }

  // 周日固定为复盘休息日
  days[6] = buildRestDay(DAY_NAMES[6], true)

  // 回填 day 名（buildRestDay 传了空串）
  days.forEach((d, i) => {
    if (!d.day) d.day = DAY_NAMES[i]
  })

  return days
}

/* ------------------------------------------------------------------ */
/* 每周反馈驱动：完成度/酸痛/睡眠/饮食 → 量化调整                        */
/* （note 自由文本暂不参与，预留给未来的 LLM 层）                        */
/* ------------------------------------------------------------------ */

/** 酸痛选项 → 肌群（与 Feedback.tsx 的 SORENESS_OPTIONS 严格对齐；"全身轻微"/"无明显酸痛" 不映射肌群） */
const SORENESS_GROUP: Record<string, MuscleGroup> = {
  胸: 'chest',
  背: 'back',
  肩: 'shoulder',
  手臂: 'arms',
  腿: 'legs',
}

/** 睡眠不足 / 饮食不达标的反馈取值（与 Feedback.tsx 的 select value 严格对齐） */
const SLEEP_LOW = '<6'
const DIET_POOR = new Set(['经常不够', '完全没注意'])

/** focus 文案 → 肌群（GROUP_LABEL 的反向映射，用于定位酸痛对应的训练日） */
const FOCUS_GROUP: Record<string, MuscleGroup> = Object.fromEntries(
  Object.entries(GROUP_LABEL).map(([g, label]) => [label, g as MuscleGroup]),
)

/**
 * 反馈 → 渐进参数修正（完成度/睡眠对"量"的影响）。
 * 与 computeProgression 串联：先按 difficulty 算基础进阶，再叠加完成度/睡眠规则。
 */
function tuneProgressionByFeedback(
  base: Progression,
  week: number,
  feedback: WeekFeedback,
): { progression: Progression; notes: string[] } {
  const step = Math.min(Math.floor((week - 1) / 2), 4)
  const notes: string[] = []
  let { extra, addSet } = base
  let setCapDelta: number | undefined
  // difficulty>=4 已在 computeProgression 内降过一阶；完成度低不再重复降（降阶只触发一次）
  let deloaded = feedback.difficulty >= 4

  // 完成度 <60%：进阶降一阶 + 组数上限 -1
  if (feedback.completion < 60) {
    if (!deloaded) extra = Math.max(0, step - 1)
    deloaded = true
    setCapDelta = -1
    notes.push(`上周完成度偏低（${feedback.completion}%），本周训练量下调`)
  }
  // 完成度 ≥90% 且感觉轻松：在常规台阶上再多进一阶
  if (feedback.completion >= 90 && feedback.difficulty <= 2) {
    extra += 1
    notes.push('上周完成度很高且感觉轻松，本周适度加量')
  }
  // 睡眠 <6h：本周不加量（不加次数也不加组；降阶仍然生效）
  if (feedback.sleep === SLEEP_LOW) {
    extra = deloaded ? Math.max(0, step - 1) : step
    addSet = false
    notes.push('睡眠不足会影响恢复，本周不加量')
  }

  return { progression: { ...base, extra, addSet, setCapDelta }, notes }
}

/**
 * 反馈 → 训练日级别调整（酸痛减量 + 睡眠/饮食提示）。
 * days 是刚构建的新对象，就地修改；返回触发的说明文案。
 */
function applyFeedbackToDays(days: DayPlan[], feedback: WeekFeedback, goal: WeightGoal): string[] {
  const notes: string[] = []

  // 酸痛：对应肌群的训练日每个动作组数 -1（不低于 2 组）+ tip 标注
  const soreGroups = new Set(
    feedback.soreness
      .map((s) => SORENESS_GROUP[s])
      .filter((g): g is MuscleGroup => g !== undefined),
  )
  if (soreGroups.size > 0) {
    for (const day of days) {
      if (day.type !== 'strength') continue
      const group = FOCUS_GROUP[day.focus]
      if (!group || !soreGroups.has(group)) continue
      day.exercises = day.exercises.map((ex) => {
        const m = ex.sets.match(/^(\d+) 组/)
        if (!m) return ex
        return { ...ex, sets: ex.sets.replace(/^(\d+) 组/, `${Math.max(2, Number(m[1]) - 1)} 组`) }
      })
      day.tip = `${day.tip ?? ''}（上周酸痛，减量恢复）`
    }
    notes.push('针对上周酸痛部位减量恢复')
  }

  // 全身轻微酸痛：不减量，只在最后一个训练日加恢复提醒
  if (feedback.soreness.includes('全身轻微')) {
    const lastTrain = [...days].reverse().find((d) => d.type === 'strength' || d.type === 'sport')
    if (lastTrain) lastTrain.tip = `${lastTrain.tip ?? ''} 上周全身轻微酸痛，注意充分热身、拉伸和恢复。`
  }

  // 睡眠不足：休息日 tip 提醒补觉
  if (feedback.sleep === SLEEP_LOW) {
    const restDay = days.find((d) => d.type === 'rest')
    if (restDay) restDay.tip = `${restDay.tip ?? ''} 上周睡眠偏少，这周尽量睡够 7-9 小时，恢复优先。`
  }

  // 饮食不达标：按目标给训练日提示（只提示，不改量）
  if (DIET_POOR.has(feedback.diet)) {
    const dietTip =
      goal === 'gain'
        ? '增肌期蛋白质要吃够（每天每公斤体重 1.6-2g），肉蛋奶/豆制品安排上。'
        : goal === 'lose'
          ? '减脂期重在稳定的热量缺口，尽量规律记录饮食，别大起大落。'
          : ''
    if (dietTip) {
      for (const day of days) {
        if (day.type === 'strength') day.tip = `${day.tip ?? ''} ${dietTip}`
      }
      notes.push('结合上周饮食情况给出营养提醒')
    }
  }

  return notes
}

/**
 * 规则引擎主函数：根据用户画像生成个性化一周计划。
 * @param profile  用户 onboarding 画像（新字段缺失时用安全默认值）
 * @param week     第几周（1 起）
 * @param feedback 上周反馈（可选）：完成度/难度/酸痛/睡眠/饮食都会参与调整
 */
export function buildWeekPlanFromProfile(
  profile: Profile,
  week: number,
  feedback?: WeekFeedback | null,
): WeekPlan {
  const equipment: Equipment = profile.equipment ?? 'none'
  const experience: Experience = profile.experience ?? 'beginner'
  const goal: WeightGoal = profile.weightGoal ?? 'gain'
  const trainDays = Math.min(Math.max(profile.trainDaysPerWeek ?? 3, 2), 6)
  const sport: Sport = profile.sport ?? 'none'
  const sportHours = profile.sportHours ?? 0

  const groups = splitMuscleGroups(trainDays, sport !== 'none' && sportHours > 0)
  const base = computeProgression(week, feedback?.difficulty)
  const { progression, notes } = feedback
    ? tuneProgressionByFeedback(base, week, feedback)
    : { progression: base, notes: [] as string[] }
  const tuning = tuneByGoal(goal)

  const days = assembleWeek(groups, {
    equipment,
    experience,
    progression,
    tuning,
    injuries: profile.injuries,
    sport,
    sportHours,
  })
  if (feedback) notes.push(...applyFeedbackToDays(days, feedback, goal))

  // adjustmentNote：进阶说明 + 反馈触发的调整；有反馈但未触发任何规则时给兜底文案
  const adjustmentNote = feedback
    ? [
        progression.note,
        ...(notes.length > 0 ? notes : ['根据上周反馈检查，本周保持原计划节奏。']),
      ].join('；')
    : progression.note

  return { week, startDate: currentMonday(), days, adjustmentNote }
}

/* ------------------------------------------------------------------ */
/* 生成下周计划：Home 跨周 / WeeklyPlan 完成本周 / Feedback CTA 共用    */
/* ------------------------------------------------------------------ */

/**
 * 统一的"生成下周计划"入口，避免多处调用发散。
 * 已 onboarded 的用户走规则引擎（吃完整 WeekFeedback）；否则回退老模板（只吃 difficulty）。
 */
export function buildNextWeekPlan(
  profile: Profile | undefined,
  fromPlan: WeekPlan,
  feedback?: WeekFeedback | null,
  targetWeek = fromPlan.week + 1,
): WeekPlan {
  return profile?.onboarded && profile.weightGoal
    ? buildWeekPlanFromProfile(profile, targetWeek, feedback)
    : buildWeekPlan(targetWeek, feedback?.difficulty)
}

/* ------------------------------------------------------------------ */
/* 复制下周：与 store.copyWeekPlan 同语义，用于规则引擎产出的计划      */
/* ------------------------------------------------------------------ */

export function copyWeekPlanFromProfile(plan: WeekPlan): WeekPlan {
  const nextMonday = format(startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  return {
    week: plan.week + 1,
    startDate: nextMonday,
    days: plan.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })),
    adjustmentNote: '沿用上周计划，未做进阶调整。',
  }
}

/* ------------------------------------------------------------------ */
/* 描述画像的自然语言（用于调整说明）                                  */
/* ------------------------------------------------------------------ */

export function describeProfile(profile: Profile): string {
  const parts: string[] = []
  if (profile.gender) parts.push(profile.gender === 'male' ? '男' : '女')
  if (profile.age) parts.push(`${profile.age} 岁`)
  if (profile.heightCm) parts.push(`${profile.heightCm}cm`)
  if (profile.weightKg) parts.push(`${profile.weightKg}kg`)
  if (profile.weightGoal) parts.push(`目标：${WEIGHT_GOAL_LABEL[profile.weightGoal]}`)
  if (profile.trainDaysPerWeek) parts.push(`${profile.trainDaysPerWeek} 天/周`)
  if (profile.experience) parts.push(profile.experience === 'beginner' ? '新手' : '进阶')
  return parts.join(' · ')
}
