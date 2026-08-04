/**
 * 动作示范数据。
 * 首选动图来源：MuscleWiki（https://musclewiki.com/zh-cn）的品牌示范视频（mp4，正面/侧面双视角）；
 * 备用图源：free-exercise-db（开源健身动作库，逐帧动画 jpg，0.jpg 正面 / 1.jpg 侧面）。
 * front / side 各自的来源按顺序尝试加载，全部失败时显示兜底提示。
 * steps 为参考 MuscleWiki 步骤说明翻译/编写的中文版。
 * 热身 / 拉伸类动作 MuscleWiki 没有对应示范视频，使用已验证存在的 free-exercise-db 逐帧图，
 * 并把 0.jpg / 1.jpg 双帧循环播放，形成动图效果。
 */

export interface DemoSource {
  type: 'video' | 'img'
  url: string
  /** 第二帧 URL，存在时与 url 循环切换，形成动图效果 */
  url2?: string
}

export interface DemoInfo {
  level: '初级' | '中级'
  front: DemoSource[]
  side: DemoSource[]
  steps: string[] // 中文步骤说明
  /** 两个媒体位的角标，默认 ['正面', '侧面']；front / side 展示两个不同动作时应给出具体动作名 */
  mediaLabels?: [string, string]
}

const MW_BASE = 'https://media.musclewiki.com/media/uploads/videos/branded'
const FED_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

/** MuscleWiki 示范视频，key 为文件名（不含扩展名） */
function mw(...keys: string[]): DemoSource[] {
  return keys.map((key) => ({ type: 'video' as const, url: `${MW_BASE}/${key}.mp4` }))
}

/** free-exercise-db 备用图，id 为目录名，frame 0=正面 1=侧面 */
function fed(frame: 0 | 1, ...ids: string[]): DemoSource[] {
  return ids.map((id) => ({ type: 'img' as const, url: `${FED_BASE}/${id}/${frame}.jpg` }))
}

/** free-exercise-db 逐帧动图：0.jpg / 1.jpg 双帧循环播放 */
function feda(...ids: string[]): DemoSource[] {
  return ids.map((id) => ({ type: 'img' as const, url: `${FED_BASE}/${id}/0.jpg`, url2: `${FED_BASE}/${id}/1.jpg` }))
}

/**
 * key 为动作名的前缀匹配：getDemo 按插入顺序返回首个前缀命中的条目。
 * 注意：若两个 key 存在前缀关系（如 "开合跳" 与 "开合跳变式"），
 * 更具体的 key 必须放在前面，否则会被较短的 key 抢先命中。
 */
const DEMOS: Record<string, DemoInfo> = {
  俯卧撑: {
    level: '初级',
    front: [...mw('male-bodyweight-push-up-front', 'male-Bodyweight-push-up-front'), ...fed(0, 'Pushups', 'Push-ups')],
    side: [...mw('male-bodyweight-push-up-side', 'male-Bodyweight-push-up-side'), ...fed(1, 'Pushups', 'Push-ups')],
    steps: [
      '双手稳稳撑地，位于肩膀正下方，略宽于肩',
      '背部放平，全身成一条直线，缓慢下放身体',
      '肩胛骨向后向下收，手肘贴近身体约 45°',
      '呼气发力推回起始位置，核心全程收紧',
    ],
  },
  上斜俯卧撑: {
    level: '初级',
    front: [
      ...mw('male-bodyweight-incline-push-up-front', 'male-dumbbell-incline-bench-press-front_q2q0T12', 'male-dumbbell-incline-bench-press-front'),
      ...fed(0, 'Incline_Push-Up', 'Incline_Push-Up_Medium'),
    ],
    side: [
      ...mw('male-bodyweight-incline-push-up-side', 'male-dumbbell-incline-bench-press-side_2HBfFN3', 'male-dumbbell-incline-bench-press-side'),
      ...fed(1, 'Incline_Push-Up', 'Incline_Push-Up_Medium'),
    ],
    steps: [
      '双手撑在稳固的凳子或床沿，略宽于肩',
      '身体从头到脚成一条直线，核心收紧',
      '屈肘缓慢下放，胸部靠近支撑面',
      '呼气推起；手越高越轻松，随周数降低高度',
    ],
  },
  哑铃飞鸟: {
    level: '初级',
    front: [...mw('male-dumbbell-chest-fly-front', 'male-dumbbell-incline-chest-flys-front'), ...fed(0, 'Dumbbell_Flyes')],
    side: [...mw('male-dumbbell-chest-fly-side', 'male-dumbbell-incline-chest-flys-side'), ...fed(1, 'Dumbbell_Flyes')],
    steps: [
      '仰卧在瑜伽垫上，双手持哑铃置于胸部上方',
      '手肘保持微屈，像环抱大树一样向两侧打开',
      '下放到大臂与身体约同一平面，感受胸部拉伸',
      '呼气沿原路线合拢，顶端挤压胸部 1 秒',
    ],
  },
  凳上臂屈伸: {
    level: '中级',
    front: [...mw('male-bodyweight-bench-dips-front', 'male-Bodyweight-bench-dips-front'), ...fed(0, 'Bench_Dips')],
    side: [...mw('male-bodyweight-bench-dips-side', 'male-Bodyweight-bench-dips-side'), ...fed(1, 'Bench_Dips')],
    steps: [
      '背对凳子，双手撑在凳沿，指尖朝前',
      '双腿前伸，臀部悬空并靠近凳子',
      '屈肘缓慢下放，至大臂与地面平行即可',
      '呼气撑起，肩膀下沉，不要耸肩',
    ],
  },
  单臂哑铃划船: {
    level: '初级',
    front: [
      ...mw('male-Dumbbells-dumbbell-kneeling-single-arm-row-front', 'male-dumbbell-kneeling-single-arm-row-front'),
      ...fed(0, 'One-Arm_Dumbbell_Row'),
    ],
    side: [
      ...mw('male-Dumbbells-dumbbell-kneeling-single-arm-row-side', 'male-dumbbell-kneeling-single-arm-row-side'),
      ...fed(1, 'One-Arm_Dumbbell_Row'),
    ],
    steps: [
      '一手和同侧膝盖撑在凳子或床沿，另一手持哑铃自然下垂',
      '背部保持平直，核心收紧',
      '沿体侧把哑铃拉向髋部，手肘贴近身体',
      '顶端收缩肩胛骨 1 秒，再缓慢下放',
    ],
  },
  俯身哑铃划船: {
    level: '中级',
    front: [...mw('male-dumbbell-row-bilateral-front', 'male-Dumbbells-dumbbell-row-bilateral-front'), ...fed(0, 'Bent_Over_Two-Dumbbell_Row')],
    side: [...mw('male-dumbbell-row-bilateral-side', 'male-Dumbbells-dumbbell-row-bilateral-side'), ...fed(1, 'Bent_Over_Two-Dumbbell_Row')],
    steps: [
      '双手各持一只哑铃，屈髋俯身约 45°，背部平直',
      '双臂自然下垂，掌心相对',
      '双哑铃同时拉向腹部两侧，手肘向后划',
      '缓慢下放还原，避免弓腰和借力甩动',
    ],
  },
  俯身反向飞鸟: {
    level: '中级',
    front: [...mw('male-dumbbell-rear-delt-fly-front', 'male-Dumbbells-dumbbell-rear-delt-fly-front'), ...fed(0, 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench')],
    side: [...mw('male-dumbbell-rear-delt-fly-side', 'male-Dumbbells-dumbbell-rear-delt-fly-side'), ...fed(1, 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench')],
    steps: [
      '双手持哑铃，屈髋俯身，背部平直',
      '手肘微屈保持固定角度，双臂垂于胸前',
      '向两侧打开到与肩同高，感受肩后束和上背发力',
      '缓慢下放，重量宁轻勿假',
    ],
  },
  哑铃弯举: {
    level: '初级',
    front: [...mw('male-Dumbbells-dumbbell-curl-front', 'male-dumbbell-bicep-curl-front'), ...fed(0, 'Dumbbell_Bicep_Curl')],
    side: [...mw('male-Dumbbells-dumbbell-curl-side', 'male-dumbbell-bicep-curl-side'), ...fed(1, 'Dumbbell_Bicep_Curl')],
    steps: [
      '站立，双手各持一只哑铃，掌心朝前',
      '大臂贴紧身体，固定不动',
      '屈肘弯举到肩部高度，顶端可旋转手腕加强收缩',
      '缓慢下放 2-3 秒，不要甩动借力',
    ],
  },
  锤式弯举: {
    level: '初级',
    front: [...mw('male-dumbbell-hammer-curl-front', 'male-Dumbbells-dumbbell-hammer-curl-front'), ...fed(0, 'Hammer_Curls')],
    side: [...mw('male-dumbbell-hammer-curl-side', 'male-Dumbbells-dumbbell-hammer-curl-side'), ...fed(1, 'Hammer_Curls')],
    steps: [
      '双手持哑铃，掌心相对（锤式握法）',
      '大臂固定在体侧，只动小臂',
      '屈肘举起到肩部高度，顶端停顿 1 秒',
      '缓慢下放；同时练到前臂，握力也受益',
    ],
  },
  哑铃肩上推举: {
    level: '中级',
    front: [...mw('male-Dumbbells-dumbbell-overhead-press-front', 'male-dumbbell-shoulder-press-front'), ...fed(0, 'Dumbbell_Shoulder_Press')],
    side: [...mw('male-Dumbbells-dumbbell-overhead-press-side', 'male-dumbbell-shoulder-press-side'), ...fed(1, 'Dumbbell_Shoulder_Press')],
    steps: [
      '坐在椅子或站立，双手持哑铃举到耳侧，掌心朝前',
      '核心收紧，腰背不要过度后仰',
      '呼气发力，垂直向上推起哑铃',
      '顶端不要锁死手肘，缓慢下放回耳侧',
    ],
  },
  哑铃侧平举: {
    level: '初级',
    front: [...mw('male-dumbbell-lateral-raise-front', 'male-Dumbbells-dumbbell-lateral-raise-front'), ...fed(0, 'Side_Lateral_Raise', 'Dumbbell_Raise')],
    side: [...mw('male-dumbbell-lateral-raise-side', 'male-Dumbbells-dumbbell-lateral-raise-side'), ...fed(1, 'Side_Lateral_Raise', 'Dumbbell_Raise')],
    steps: [
      '站立，双手持哑铃垂于体侧，手肘微屈',
      '向两侧举起手臂，到与肩同高即可',
      '想象"倒水"姿势，小指略高于拇指',
      '慢上慢下，不要耸肩借力',
    ],
  },
  俯身侧平举: {
    level: '中级',
    front: [...mw('male-dumbbell-rear-delt-fly-front', 'male-Dumbbells-dumbbell-rear-delt-fly-front'), ...fed(0, 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench')],
    side: [...mw('male-dumbbell-rear-delt-fly-side', 'male-Dumbbells-dumbbell-rear-delt-fly-side'), ...fed(1, 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench')],
    steps: [
      '双手持轻哑铃，俯身约 45°，背部平直',
      '手肘微屈，双臂垂于胸前',
      '向两侧打开到肩高，专注三角肌后束收缩',
      '缓慢下放，重量宁轻勿假',
    ],
  },
  平板支撑: {
    level: '初级',
    front: [...mw('male-bodyweight-forearm-plank-front'), ...fed(0, 'Plank')],
    side: [...mw('male-bodyweight-forearm-plank-side'), ...fed(1, 'Plank')],
    steps: [
      '前臂撑地，手肘位于肩膀正下方',
      '身体从头到脚跟成一条直线',
      '收腹夹臀，不塌腰、不撅臀',
      '保持均匀呼吸，坚持目标时长',
    ],
  },
  卷腹: {
    level: '初级',
    front: [...mw('male-bodyweight-crunch-front'), ...fed(0, 'Crunches')],
    side: [...mw('male-bodyweight-crunch-side'), ...fed(1, 'Crunches')],
    steps: [
      '仰卧屈膝，双脚平放地面',
      '手轻扶耳侧，不要抱头拉脖子',
      '呼气卷起上背部，下背保持贴地',
      '顶端收缩腹部，缓慢下放',
    ],
  },
  // 当前训练计划中没有独立命名为"开合跳"的动作（只有"热身：开合跳"），此条为后续计划预留
  开合跳: {
    level: '初级',
    front: [...mw('male-Cardio-cardio-jumping-jacks-front'), ...fed(0, 'Star_Jump')],
    side: [...mw('male-Cardio-cardio-jumping-jacks-side'), ...fed(1, 'Star_Jump')],
    steps: [
      '站立，双脚并拢，手臂自然放于体侧',
      '跳起时双脚向两侧打开，双手举过头顶',
      '再跳回起始姿势，保持轻快节奏',
      '落地轻缓、膝盖微屈缓冲，配合呼吸',
    ],
  },
  // —— 以下为热身 / 拉伸类动作，图源为 free-exercise-db 逐帧动画 ——
  '热身：开合跳': {
    level: '初级',
    front: [...mw('male-Cardio-cardio-jumping-jacks-front'), ...feda('Star_Jump'), ...fed(0, 'Dynamic_Chest_Stretch')],
    side: [...mw('male-Cardio-cardio-jumping-jacks-side'), ...feda('Star_Jump'), ...fed(1, 'Dynamic_Chest_Stretch')],
    steps: [
      '先做 1-2 分钟开合跳，把心率慢慢提上来',
      '再做肩部绕环：双肩向后画大圈，正反各 10 次',
      '扩胸运动：双臂体前水平开合 15-20 次，幅度逐渐加大',
      '热身到微微出汗、关节活动开，再开始正式训练',
    ],
  },
  '胸部 + 三头静态拉伸': {
    level: '初级',
    front: [...feda('Behind_Head_Chest_Stretch'), ...fed(0, 'Triceps_Stretch')],
    side: [...feda('Triceps_Stretch'), ...fed(1, 'Behind_Head_Chest_Stretch')],
    mediaLabels: ['胸部拉伸', '三头拉伸'],
    steps: [
      '胸部拉伸：站立，双手在头后交扣，手肘向后打开，挺胸感受胸部牵拉',
      '保持 20-30 秒，自然呼吸，不要弹振',
      '三头拉伸：一手举过头顶屈肘摸向对侧肩胛，另一手轻压手肘',
      '每侧保持 20-30 秒，两侧交替进行',
    ],
  },
  全身拉伸: {
    level: '初级',
    front: [...feda('Worlds_Greatest_Stretch'), ...fed(0, 'Chest_And_Front_Of_Shoulder_Stretch')],
    side: [...feda('Chest_And_Front_Of_Shoulder_Stretch'), ...fed(1, 'Worlds_Greatest_Stretch')],
    mediaLabels: ['世界最伟大拉伸', '胸肩拉伸'],
    steps: [
      '每个部位保持 20-30 秒，全程缓慢深呼吸',
      '胸肩：双手背后交扣，挺胸抬臂，感受胸部和肩前束牵拉',
      '配合"世界最伟大拉伸"活动髋部与胸椎',
      '拉伸到有明显牵拉感但不疼痛的程度即可',
    ],
  },
  '热身：弹力带': {
    level: '初级',
    front: [...feda('Round_The_World_Shoulder_Stretch'), ...fed(0, 'Cat_Stretch')],
    side: [...feda('Cat_Stretch'), ...fed(1, 'Round_The_World_Shoulder_Stretch')],
    mediaLabels: ['弹力带绕肩', '猫式伸展'],
    steps: [
      '双手握弹力带或毛巾，握距约为肩宽的 1.5 倍',
      '手臂伸直，从体前缓慢绕到体后再绕回，做 10-15 次',
      '猫式伸展：四点跪姿，吸气塌腰抬头，呼气拱背低头',
      '猫式做 8-10 次，配合呼吸，把脊柱活动开',
    ],
  },
  '背部 + 二头静态拉伸': {
    level: '初级',
    front: [...feda('Upper_Back_Stretch'), ...fed(0, 'Standing_Biceps_Stretch')],
    side: [...feda('Standing_Biceps_Stretch'), ...fed(1, 'Upper_Back_Stretch')],
    mediaLabels: ['上背拉伸', '二头拉伸'],
    steps: [
      '上背拉伸：双臂前伸、双手交扣，含胸拱背把肩胛撑开',
      '保持 20-30 秒，感受肩胛骨之间的牵拉',
      '二头拉伸：手臂伸直向后打开、掌心朝前，可扶墙固定',
      '每侧 20-30 秒，肩膀保持下沉不要耸肩',
    ],
  },
  '热身：肩部环绕': {
    level: '初级',
    front: [...feda('Shoulder_Circles'), ...fed(0, 'External_Rotation')],
    side: [...feda('External_Rotation'), ...fed(1, 'Shoulder_Circles')],
    mediaLabels: ['肩部环绕', '招财猫式'],
    steps: [
      '肩部环绕：双肩向上、向后、向下画大圈，正反各 10 次',
      '再做手臂绕环：双臂侧平举，向前向后画小圈各 15 次',
      '招财猫式：大臂侧平举与肩同高，小臂像招财猫一样上下旋转',
      '招财猫做 12-15 次，激活肩袖肌群，预防肩部伤病',
    ],
  },
  肩部拉伸: {
    level: '初级',
    front: [...feda('Shoulder_Stretch'), ...fed(0, 'Overhead_Stretch')],
    side: [...feda('Overhead_Stretch'), ...fed(1, 'Shoulder_Stretch')],
    mediaLabels: ['胸前横拉', '过头拉伸'],
    steps: [
      '一手横过胸前，另一手托住手肘轻轻拉向身体',
      '保持 20-30 秒，感受三角肌后束牵拉，两侧交替',
      '再做过头拉伸：双臂上举交扣，分别向左右侧屈',
      '全程自然呼吸，肩膀放松不要耸肩',
    ],
  },
  动态热身: {
    level: '初级',
    front: [...feda('Ankle_Circles'), ...fed(0, 'Arm_Circles')],
    side: [...feda('Arm_Circles'), ...fed(1, 'Ankle_Circles')],
    mediaLabels: ['踝关节环绕', '手臂绕环'],
    steps: [
      '踝关节环绕：单脚站立，脚尖点地画圈，每脚正反各 10 次',
      '膝关节环绕：双脚并拢、双手扶膝，顺逆时针各 10 次',
      '手臂绕环：双臂侧平举画圈，由小到大，正反各 15 次',
      '再做 1 分钟原地小跑或开合跳，让全身热起来',
    ],
  },
  赛后静态拉伸: {
    level: '初级',
    front: [...feda('Standing_Gastrocnemius_Calf_Stretch'), ...fed(0, 'Side_Wrist_Pull')],
    side: [...feda('Side_Wrist_Pull'), ...fed(1, 'Standing_Gastrocnemius_Calf_Stretch')],
    mediaLabels: ['小腿拉伸', '手腕拉伸'],
    steps: [
      '小腿拉伸：双手推墙，一腿后伸脚跟着地，身体前倾，每侧 30 秒',
      '肩部拉伸：一手横过胸前，另一手托肘拉近身体，每侧 30 秒',
      '手腕拉伸：手臂前伸掌心朝前，另一手轻掰手指向后，每侧 20 秒',
      '所有动作静态保持、缓慢呼吸，不要弹振',
    ],
  },
}

/** 按动作名前缀查找示范数据 */
export function getDemo(exerciseName: string): DemoInfo | undefined {
  for (const key of Object.keys(DEMOS)) {
    if (exerciseName.startsWith(key)) return DEMOS[key]
  }
  return undefined
}
