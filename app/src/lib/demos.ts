/**
 * 动作示范数据。
 * 动图来源：free-exercise-db（开源健身动作库，图片实为逐帧动画，浏览器可直接播放）
 * ids 为候选目录名，按顺序尝试加载，全部失败时显示兜底提示。
 */

export interface DemoInfo {
  ids: string[]
  cues: string[] // 动作要点
}

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

export function demoUrl(id: string): string {
  return `${BASE}/${id}/0.jpg`
}

/** key 为动作名的前缀匹配 */
const DEMOS: Record<string, DemoInfo> = {
  俯卧撑: {
    ids: ['Pushups', 'Push-ups', 'Push_Up', 'Decline_Push-Up', 'Incline_Push-Up'],
    cues: ['双手略宽于肩，身体成一条直线', '下放时胸部贴近地面，肘部约 45°', '核心收紧，不要塌腰或撅臀'],
  },
  上斜俯卧撑: {
    ids: ['Incline_Push-Up', 'Incline_Push-Up_Medium'],
    cues: ['双手撑在稳固的凳子/床沿，略宽于肩', '身体保持直线，缓慢下放', '手越高越轻松，随周数降低高度'],
  },
  哑铃飞鸟: {
    ids: ['Dumbbell_Flyes'],
    cues: ['手肘微屈保持固定角度', '像环抱大树一样打开再合拢', '顶端挤压胸部 1 秒'],
  },
  凳上臂屈伸: {
    ids: ['Bench_Dips'],
    cues: ['双手撑在身后凳沿，指尖朝前', '下放至大臂与地面平行即可', '肩膀下沉，不要耸肩'],
  },
  单臂哑铃划船: {
    ids: ['One-Arm_Dumbbell_Row'],
    cues: ['一手一膝撑凳，背部保持平直', '哑铃沿体侧拉向髋部', '顶端收缩肩胛骨 1 秒'],
  },
  俯身哑铃划船: {
    ids: ['Bent_Over_Two-Dumbbell_Row', 'Bent_Over_Two-Dumbbell_Row_With_Palms_In'],
    cues: ['屈髋俯身约 45°，背部平直', '双哑铃同时拉向腹部两侧', '避免弓腰和借力甩动'],
  },
  俯身反向飞鸟: {
    ids: ['Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench'],
    cues: ['小重量！俯身、手肘微屈', '向两侧打开到与肩同高', '感受肩后束和上背发力'],
  },
  哑铃弯举: {
    ids: ['Dumbbell_Bicep_Curl', 'Dumbbell_Alternate_Bicep_Curl'],
    cues: ['大臂贴紧身体固定不动', '顶端旋转手腕（旋后）收缩二头', '下放要慢，约 2-3 秒'],
  },
  锤式弯举: {
    ids: ['Hammer_Curls', 'Alternate_Hammer_Curl'],
    cues: ['掌心相对（锤式握法）', '大臂固定，只动小臂', '同时练到前臂，握力也受益'],
  },
  哑铃肩上推举: {
    ids: ['Dumbbell_Shoulder_Press', 'Dumbbell_One-Arm_Shoulder_Press'],
    cues: ['起始位置哑铃在耳侧', '垂直向上推起，不耸肩', '顶端不要锁死手肘'],
  },
  哑铃侧平举: {
    ids: ['Side_Lateral_Raise', 'Lateral_Raise_-_With_Bands', 'Dumbbell_Raise'],
    cues: ['小重量、手肘微屈', '举到与肩同高即可，不要过高', '想象"倒水"姿势，慢上慢下'],
  },
  俯身侧平举: {
    ids: ['Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench'],
    cues: ['练三角肌后束，改善圆肩', '俯身 45°，向两侧打开', '重量宁轻勿假'],
  },
  平板支撑: {
    ids: ['Plank'],
    cues: ['前臂撑地，身体成一条直线', '收腹夹臀，不塌腰不撅臀', '均匀呼吸，别憋气'],
  },
  卷腹: {
    ids: ['Crunches'],
    cues: ['下背贴地，只卷起上背', '手轻扶耳侧，不要抱头拉脖子', '顶端呼气收缩腹部'],
  },
  开合跳: {
    ids: ['Jumping_Jack', 'Star_Jumps', 'Seal_Jumps'],
    cues: ['落地轻缓，膝盖微屈缓冲', '配合呼吸，心率逐步提升', '作为热身做 1-2 分钟即可'],
  },
}

/** 按动作名前缀查找示范数据 */
export function getDemo(exerciseName: string): DemoInfo | undefined {
  for (const key of Object.keys(DEMOS)) {
    if (exerciseName.startsWith(key)) return DEMOS[key]
  }
  return undefined
}
