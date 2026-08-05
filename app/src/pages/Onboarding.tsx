import { useState } from 'react'
import { ArrowLeft, ArrowRight, Dumbbell, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buildWeekPlanFromProfile, describeProfile } from '@/lib/planEngine'
import type {
  Equipment,
  Experience,
  Gender,
  Profile,
  Sport,
  WeekPlan,
  WeightGoal,
} from '@/types'

type Step = 'basics' | 'goal' | 'training'

const STEPS: { key: Step; title: string; desc: string }[] = [
  { key: 'basics', title: '基础信息', desc: '先了解一下你的身体情况' },
  { key: 'goal', title: '训练目标', desc: '你希望达到什么目标' },
  { key: 'training', title: '训练偏好', desc: '器械、频率和运动习惯' },
]

/** 可选伤病/不适部位 */
const INJURY_OPTIONS = ['膝盖', '肩', '腰 / 下背', '手腕', '脚踝'] as const

interface Draft {
  gender: Gender
  age: number
  heightCm: number
  weightKg: number
  weightGoal: WeightGoal
  experience: Experience
  trainDaysPerWeek: number
  equipment: Equipment
  sport: Sport
  sportHours: number
  injuries: string[]
}

interface Props {
  /** 已存在的 profile（老用户重新定制时回填），新用户为 undefined */
  existing?: Profile
  /** 完成回调：返回组装好的 profile 和匹配的初始计划 */
  onComplete: (profile: Profile, weekPlan: WeekPlan) => void
  /** 取消（仅老用户重新定制时显示） */
  onCancel?: () => void
}

/**
 * 新用户引导 / 老用户重新定制。
 * 3 步向导，参考 Auth.tsx 的 type Step + 条件渲染范式。
 * 完成后调规则引擎生成个性化第 1 周计划。
 */
export default function Onboarding({ existing, onComplete, onCancel }: Props) {
  const [step, setStep] = useState<Step>('basics')
  const [draft, setDraft] = useState<Draft>(() => ({
    gender: existing?.gender ?? 'male',
    age: existing?.age ?? 25,
    heightCm: existing?.heightCm ?? 170,
    weightKg: existing?.weightKg ?? 60,
    weightGoal: existing?.weightGoal ?? 'gain',
    experience: existing?.experience ?? 'beginner',
    trainDaysPerWeek: existing?.trainDaysPerWeek ?? 3,
    equipment: existing?.equipment ?? 'none',
    sport: existing?.sport ?? 'none',
    sportHours: existing?.sportHours ?? 0,
    injuries: existing?.injuries ?? [],
  }))

  const stepIdx = STEPS.findIndex((s) => s.key === step)
  const progressPct = ((stepIdx + 1) / STEPS.length) * 100

  const isBasicsValid =
    draft.age >= 10 && draft.age <= 100 && draft.heightCm >= 100 && draft.heightCm <= 250 && draft.weightKg >= 25 && draft.weightKg <= 300

  const next = () => {
    if (step === 'basics') {
      if (!isBasicsValid) {
        toast.error('请检查基础信息填写是否合理')
        return
      }
      setStep('goal')
    } else if (step === 'goal') {
      setStep('training')
    }
  }

  const back = () => {
    if (step === 'training') setStep('goal')
    else if (step === 'goal') setStep('basics')
  }

  const finish = () => {
    const profile: Profile = {
      ...(existing ?? { name: '我' }),
      gender: draft.gender,
      age: draft.age,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
      weightGoal: draft.weightGoal,
      experience: draft.experience,
      trainDaysPerWeek: draft.trainDaysPerWeek,
      equipment: draft.equipment,
      sport: draft.sport,
      sportHours: draft.sportHours,
      injuries: draft.injuries,
      onboarded: true,
    }
    const weekPlan = buildWeekPlanFromProfile(profile, 1)
    onComplete(profile, weekPlan)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background p-4">
      <Card className="w-full max-w-lg rounded-2xl shadow-lg">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/30">
            <Dumbbell className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">{existing ? '重新定制计划' : '欢迎来到 FitUp'}</CardTitle>
          <CardDescription>{STEPS[stepIdx].desc}</CardDescription>
          <div className="mt-2 w-full">
            <Progress value={progressPct} className="h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">
              第 {stepIdx + 1} / {STEPS.length} 步
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {step === 'basics' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>性别</Label>
                <RadioGroup
                  value={draft.gender}
                  onValueChange={(v) => setDraft((d) => ({ ...d, gender: v as Gender }))}
                  className="grid grid-cols-2 gap-3"
                >
                  {(['male', 'female'] as const).map((g) => (
                    <label
                      key={g}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <RadioGroupItem value={g} id={`gender-${g}`} />
                      <span className="text-sm">{g === 'male' ? '男' : '女'}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-age">年龄</Label>
                  <Input
                    id="ob-age"
                    type="number"
                    value={draft.age}
                    onChange={(e) => setDraft((d) => ({ ...d, age: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-height">身高 cm</Label>
                  <Input
                    id="ob-height"
                    type="number"
                    value={draft.heightCm}
                    onChange={(e) => setDraft((d) => ({ ...d, heightCm: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-weight">体重 kg</Label>
                  <Input
                    id="ob-weight"
                    type="number"
                    value={draft.weightKg}
                    onChange={(e) => setDraft((d) => ({ ...d, weightKg: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 'goal' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>你的主要目标</Label>
                <RadioGroup
                  value={draft.weightGoal}
                  onValueChange={(v) => setDraft((d) => ({ ...d, weightGoal: v as WeightGoal }))}
                  className="grid grid-cols-2 gap-3"
                >
                  {([
                    ['gain', '增肌', '增加肌肉量，让身体更结实'],
                    ['lose', '减脂', '减少脂肪，让线条更清晰'],
                    ['recomp', '塑形', '增肌减脂兼顾，改善体态'],
                    ['maintain', '保持', '维持现状，规律锻炼'],
                  ] as const).map(([val, title, desc]) => (
                    <label
                      key={val}
                      className="flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <span className="flex items-center gap-2">
                        <RadioGroupItem value={val} id={`goal-${val}`} />
                        <span className="text-sm font-medium">{title}</span>
                      </span>
                      <span className="pl-6 text-xs text-muted-foreground">{desc}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {step === 'training' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>训练经验</Label>
                <RadioGroup
                  value={draft.experience}
                  onValueChange={(v) => setDraft((d) => ({ ...d, experience: v as Experience }))}
                  className="grid grid-cols-2 gap-3"
                >
                  {([
                    ['beginner', '新手', '刚开始规律训练'],
                    ['intermediate', '进阶', '已有半年以上基础'],
                  ] as const).map(([val, title, desc]) => (
                    <label
                      key={val}
                      className="flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <span className="flex items-center gap-2">
                        <RadioGroupItem value={val} id={`exp-${val}`} />
                        <span className="text-sm font-medium">{title}</span>
                      </span>
                      <span className="pl-6 text-xs text-muted-foreground">{desc}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>每周能练几天</Label>
                  <span className="text-sm font-medium text-primary">{draft.trainDaysPerWeek} 天</span>
                </div>
                <Slider
                  value={[draft.trainDaysPerWeek]}
                  min={2}
                  max={6}
                  step={1}
                  onValueChange={(v) => setDraft((d) => ({ ...d, trainDaysPerWeek: v[0] }))}
                />
                <p className="text-xs text-muted-foreground">2-6 天，强度会根据天数自动分配肌群</p>
              </div>

              <div className="space-y-2">
                <Label>可用器械</Label>
                <RadioGroup
                  value={draft.equipment}
                  onValueChange={(v) => setDraft((d) => ({ ...d, equipment: v as Equipment }))}
                  className="grid grid-cols-3 gap-3"
                >
                  {([
                    ['none', '无器械', '居家徒手'],
                    ['dumbbell', '哑铃', '含弹力带'],
                    ['gym', '健身房', '器械齐全'],
                  ] as const).map(([val, title, desc]) => (
                    <label
                      key={val}
                      className="flex cursor-pointer flex-col items-center gap-0.5 rounded-xl border p-3 text-center has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <RadioGroupItem value={val} id={`eq-${val}`} className="sr-only" />
                      <span className="text-sm font-medium">{title}</span>
                      <span className="text-xs text-muted-foreground">{desc}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>专项运动（可选）</Label>
                <Select
                  value={draft.sport}
                  onValueChange={(v) => setDraft((d) => ({ ...d, sport: v as Sport, sportHours: v === 'none' ? 0 : d.sportHours || 2 }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择你常做的运动" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不专门安排运动日</SelectItem>
                    <SelectItem value="badminton">羽毛球</SelectItem>
                    <SelectItem value="running">跑步</SelectItem>
                    <SelectItem value="cycling">骑行</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {draft.sport !== 'none' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>每周运动时长</Label>
                    <span className="text-sm font-medium text-primary">{draft.sportHours} 小时</span>
                  </div>
                  <Slider
                    value={[draft.sportHours]}
                    min={1}
                    max={6}
                    step={1}
                    onValueChange={(v) => setDraft((d) => ({ ...d, sportHours: v[0] }))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>伤病 / 不适部位（可跳过）</Label>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={draft.injuries}
                  onValueChange={(vals) => setDraft((d) => ({ ...d, injuries: vals }))}
                  className="flex flex-wrap gap-2"
                >
                  {INJURY_OPTIONS.map((opt) => (
                    <ToggleGroupItem key={opt} value={opt} className="rounded-full">
                      {opt}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <p className="text-xs text-muted-foreground">相关动作会自动替换或降阶</p>
              </div>

              {/* 预览 */}
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <p className="mb-1 flex items-center gap-1.5 font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  你的画像
                </p>
                <p className="text-muted-foreground">
                  {describeProfile({
                    ...draft,
                    name: '我',
                  })}
                </p>
              </div>
            </div>
          )}

          {/* 导航按钮 */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {step === 'basics' && onCancel ? (
                <Button variant="ghost" onClick={onCancel}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  取消
                </Button>
              ) : stepIdx > 0 ? (
                <Button variant="ghost" onClick={back}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  上一步
                </Button>
              ) : null}
            </div>
            {step === 'training' ? (
              <Button onClick={finish}>
                <Sparkles className="mr-1 h-4 w-4" />
                {existing ? '重新生成计划' : '生成我的计划'}
              </Button>
            ) : (
              <Button onClick={next}>
                下一步
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
