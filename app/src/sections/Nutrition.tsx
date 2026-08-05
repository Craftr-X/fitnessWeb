import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Beef, Droplets, Moon, UtensilsCrossed } from 'lucide-react'
import { proteinRange } from '@/lib/store'
import type { WeightEntry, WeightGoal } from '@/types'

interface Props {
  weights: WeightEntry[]
  /** 体重目标，决定热量盈余/缺口；老用户无此字段时默认增肌（沿用旧逻辑） */
  weightGoal?: WeightGoal
}

const PROTEIN_FOODS = [
  { food: '鸡蛋 1 个（约 55g）', protein: '≈ 7 g', tip: '性价比之王，每天 2-3 个' },
  { food: '鸡胸肉 100 g', protein: '≈ 24 g', tip: '增肌主力，煎/煮/空气炸锅都行' },
  { food: '鱼虾 100 g', protein: '≈ 18-20 g', tip: '脂肪低，训练日晚餐推荐' },
  { food: '牛奶 250 ml', protein: '≈ 8 g', tip: '睡前一杯，兼顾补钙' },
  { food: '无糖酸奶 200 g', protein: '≈ 7-10 g', tip: '加餐好选择' },
  { food: '豆腐 150 g', protein: '≈ 9 g', tip: '植物蛋白补充' },
  { food: '蛋白粉 1 勺（30 g）', protein: '≈ 22-24 g', tip: '吃不够时再考虑，非必需' },
]

/** 按体重目标计算热量调整：每日维持热量 + 盈余/缺口 */
function calorieTarget(weight: number, goal: WeightGoal | undefined): { target: number; label: string; tip: string } {
  const maintenance = Math.round(weight * 32) // 粗略维持热量
  switch (goal) {
    case 'lose':
      return {
        target: maintenance - 400,
        label: '每日热量目标（维持 −400 减脂缺口）',
        tip: '减脂期保持蛋白质充足、力量训练不减量，缺口主要从碳水和脂肪里出。每周体重下降 0.25-0.5 kg 为宜。',
      }
    case 'recomp':
      return {
        target: maintenance,
        label: '每日热量目标（维持，靠训练重塑身体成分）',
        tip: '塑形期热量维持即可，重点是训练强度和蛋白质，体脂和体重会缓慢此消彼长。',
      }
    case 'maintain':
      return {
        target: maintenance,
        label: '每日热量目标（维持）',
        tip: '保持期维持当前饮食即可，重在规律训练和睡眠。',
      }
    case 'gain':
    default:
      // 老用户无 goal 字段时默认增肌，沿用旧 +250 逻辑
      return {
        target: maintenance + 250,
        label: '每日热量目标（维持 +250 温和盈余）',
        tip: '偏瘦增肌的关键不是"吃撑"，而是每天稳定地多吃一点（约 +250 kcal），配合训练让体重每周缓慢上涨 0.1-0.25 kg。',
      }
  }
}

export default function Nutrition({ weights, weightGoal }: Props) {
  const weight = weights[weights.length - 1]?.weight ?? 50.5
  const [pMin, pMax] = useMemo(() => proteinRange(weight), [weight])
  const { target, label, tip } = useMemo(() => calorieTarget(weight, weightGoal), [weight, weightGoal])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <Beef className="mx-auto mb-1 h-6 w-6 text-orange-500" />
            <div className="text-2xl font-bold">{pMin}–{pMax} g</div>
            <div className="text-xs text-muted-foreground">每日蛋白质目标（1.6-2.0 g/kg）</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <UtensilsCrossed className="mx-auto mb-1 h-6 w-6 text-emerald-500" />
            <div className="text-2xl font-bold">≈ {target} kcal</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Droplets className="mx-auto mb-1 h-6 w-6 text-sky-500" />
            <div className="text-2xl font-bold">2–2.5 L</div>
            <div className="text-xs text-muted-foreground">每日饮水（羽毛球日额外补 500ml+）</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">常见高蛋白食物速查</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>食物</TableHead>
                <TableHead>蛋白质含量</TableHead>
                <TableHead>小贴士</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PROTEIN_FOODS.map((f) => (
                <TableRow key={f.food}>
                  <TableCell className="font-medium">{f.food}</TableCell>
                  <TableCell>{f.protein}</TableCell>
                  <TableCell className="text-muted-foreground">{f.tip}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">一日饮食示例（≈ 90 g 蛋白质）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="font-medium">早餐：</span>2 个鸡蛋 + 一杯牛奶 + 全麦面包（≈ 22 g）</p>
          <p><span className="font-medium">午餐：</span>正常吃，确保一掌大的肉/鱼/豆制品（≈ 25 g）</p>
          <p><span className="font-medium">加餐：</span>无糖酸奶 + 一根香蕉（≈ 8 g，训练前 1 小时吃正好）</p>
          <p><span className="font-medium">晚餐：</span>鸡胸/鱼虾 120 g + 米饭 + 蔬菜（≈ 30 g）</p>
          <p><span className="font-medium">睡前：</span>一杯牛奶（≈ 8 g）</p>
          <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
            💡 {tip}
            {weightGoal === 'gain' || !weightGoal ? ' 运动日消耗大，当天可额外加一顿碳水加餐。' : ''}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Moon className="h-4 w-4 text-indigo-400" /> 恢复同样重要
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>· 睡眠 7-9 小时：生长激素主要在深睡眠分泌，熬夜会直接拖慢增肌。</p>
          <p>· 同一肌群间隔至少 48 小时：计划里胸/背/肩分别隔开的安排就是这个原因。</p>
          <p>· 训练后 30 分钟内补充蛋白质 + 碳水（如牛奶 + 香蕉），恢复效率最高。</p>
          <p>· 连续两天明显疲劳或酸痛超过 3 天，就主动休息一天，在反馈里告诉我。</p>
        </CardContent>
      </Card>
    </div>
  )
}
