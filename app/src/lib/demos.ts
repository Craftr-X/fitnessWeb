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
    front: [...mw('male-bodyweight-push-up-front', 'male-Bodyweight-push-up-front'), ...fed(0, 'Pushups')],
    side: [...mw('male-bodyweight-push-up-side', 'male-Bodyweight-push-up-side'), ...fed(1, 'Pushups')],
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

  // —— 以下为规则引擎（planEngine）新用户计划动作补齐 ——
  // 图源：MuscleWiki 品牌视频（已 HEAD 验证 206）+ free-exercise-db 兜底图，404 自动降级。

  // ===== 腿部 =====
  徒手深蹲: {
    level: '初级',
    front: [...mw('male-Bodyweight-bodyweight-squat-front'), ...feda('Bodyweight_Squat')],
    side: [...mw('male-Bodyweight-bodyweight-squat-side'), ...fed(1, 'Bodyweight_Squat')],
    steps: [
      '双脚与肩同宽，脚尖略外展',
      '下蹲时臀部后坐，膝盖沿脚尖方向，大腿蹲到与地面平行或更低',
      '全程挺胸收腹，背部保持平直，不要弓腰',
      '脚跟蹬地站起，顶端收紧臀部，不要完全锁死膝盖',
    ],
  },
  哑铃高脚杯深蹲: {
    level: '初级',
    front: [...feda('Dumbbell_Squat'), ...fed(0, 'Bodyweight_Squat')],
    side: [...fed(1, 'Dumbbell_Squat'), ...fed(1, 'Bodyweight_Squat')],
    steps: [
      '双手捧一只哑铃竖立于胸前（高脚杯握法）',
      '双脚与肩同宽，挺胸收腹，哑铃贴近身体',
      '臀部后坐下蹲，大腿至少与地面平行，肘部触膝',
      '脚跟蹬地站起，保持躯干直立，顶端收紧臀部',
    ],
  },
  杠铃深蹲: {
    level: '中级',
    front: [...mw('male-Barbell-barbell-squat-front'), ...feda('Barbell_Squat')],
    side: [...mw('male-Barbell-barbell-squat-side'), ...fed(1, 'Barbell_Squat')],
    steps: [
      '杠铃置于斜方肌上方（高杠位），双脚与肩同宽，脚尖略外展',
      '核心收紧，挺胸，背部保持平直',
      '臀部后坐同时屈膝下蹲，大腿蹲到与地面平行或更低',
      '脚跟蹬地站起，全程保持杠铃轨迹垂直，膝盖不内扣',
    ],
  },
  弓步蹲: {
    level: '初级',
    front: [...mw('male-Dumbbells-dumbbell-forward-lunge-front'), ...feda('Dumbbell_Lunges')],
    side: [...mw('male-Dumbbells-dumbbell-forward-lunge-side'), ...fed(1, 'Dumbbell_Lunges')],
    steps: [
      '站立，一脚向前迈一大步（约一个腿长距离）',
      '前脚着地后屈膝下蹲，前膝沿脚尖方向，后膝接近地面',
      '下蹲到前大腿与地面平行，躯干保持直立',
      '前脚跟蹬地站起回到起始位置，两侧交替进行',
    ],
  },
  哑铃弓步蹲: {
    level: '初级',
    front: [...mw('male-Dumbbells-dumbbell-forward-lunge-front'), ...feda('Dumbbell_Lunges')],
    side: [...mw('male-Dumbbells-dumbbell-forward-lunge-side'), ...fed(1, 'Dumbbell_Lunges')],
    steps: [
      '双手各持一只哑铃垂于体侧，站立挺胸',
      '一脚向前迈一大步，前脚着地后屈膝下蹲',
      '前膝沿脚尖方向，后膝接近地面，躯干保持直立',
      '前脚跟蹬地站起回到起始位置，两侧交替进行',
    ],
  },
  臀桥: {
    level: '初级',
    front: [...mw('male-barbell-glute-bridge-front'), ...feda('Butt_Lift_Bridge')],
    side: [...mw('male-barbell-glute-bridge-side'), ...fed(1, 'Butt_Lift_Bridge')],
    steps: [
      '仰卧屈膝，双脚平放地面，与肩同宽',
      '脚跟蹬地，把臀部顶到与身体成一条直线',
      '顶端收紧臀部，停顿 1-2 秒，感受臀部收缩',
      '缓慢下放，下背不要过度反弓',
    ],
  },
  罗马尼亚硬拉: {
    level: '中级',
    front: [...mw('male-Barbell-barbell-romanian-deadlift-front'), ...feda('Romanian_Deadlift'), ...fed(0, 'Stiff-Legged_Dumbbell_Deadlift')],
    side: [...mw('male-Barbell-barbell-romanian-deadlift-side'), ...fed(1, 'Romanian_Deadlift'), ...fed(1, 'Stiff-Legged_Dumbbell_Deadlift')],
    steps: [
      '双脚与髋同宽，杠铃/哑铃置于大腿前',
      '屈髋俯身，臀部向后推，膝盖微屈保持固定',
      '杠铃沿大腿前缘下放至小腿中段，感受大腿后侧拉伸',
      '臀部发力站起，顶端收紧臀部，全程背部平直不弓腰',
    ],
  },
  哑铃罗马尼亚硬拉: {
    level: '中级',
    front: [...mw('male-Barbell-barbell-romanian-deadlift-front'), ...feda('Romanian_Deadlift'), ...fed(0, 'Stiff-Legged_Dumbbell_Deadlift')],
    side: [...mw('male-Barbell-barbell-romanian-deadlift-side'), ...fed(1, 'Romanian_Deadlift'), ...fed(1, 'Stiff-Legged_Dumbbell_Deadlift')],
    steps: [
      '双手各持哑铃置于大腿前，双脚与髋同宽',
      '屈髋俯身，臀部向后推，膝盖微屈保持固定',
      '哑铃沿大腿前缘下放至小腿中段，感受大腿后侧拉伸',
      '臀部发力站起，顶端收紧臀部，全程背部平直不弓腰',
    ],
  },
  腿举: {
    level: '中级',
    front: [...fed(0, 'Leg_Press')],
    side: [...fed(1, 'Leg_Press')],
    steps: [
      '坐在腿举机上，双脚与肩同宽放在踏板中上部',
      '解锁安全锁，双脚蹬起重量，膝盖不完全锁死',
      '屈膝下放踏板至膝盖约 90°，脚跟不要离板',
      '脚掌发力推回起始位置，核心收紧，下背贴紧靠背',
    ],
  },

  // ===== 胸部（卧推 / 飞鸟补充） =====
  哑铃卧推: {
    level: '初级',
    front: [...feda('Dumbbell_Bench_Press')],
    side: [...fed(1, 'Dumbbell_Bench_Press')],
    steps: [
      '仰卧在凳子或地板上，双手持哑铃置于胸部两侧',
      '掌心朝前，哑铃与身体在同一平面，手肘约 45°',
      '垂直向上推起哑铃，到顶端轻微靠近但不碰撞',
      '缓慢下放至胸部两侧，感受胸部拉伸，全幅度完成',
    ],
  },
  哑铃上斜卧推: {
    level: '初级',
    front: [...fed(0, 'Dumbbell_Bench_Press'), ...fed(0, 'Incline_Dumbbell_Press')],
    side: [...fed(1, 'Dumbbell_Bench_Press'), ...fed(1, 'Incline_Dumbbell_Press')],
    steps: [
      '仰卧在上斜凳上（30-45°），双手持哑铃置于胸部两侧',
      '掌心朝前，哑铃与身体在同一平面，手肘约 45°',
      '垂直向上推起哑铃，重点感受上胸发力',
      '缓慢下放至上胸两侧，全幅度完成，避免拱腰借力',
    ],
  },
  上斜哑铃卧推: {
    level: '初级',
    front: [...fed(0, 'Incline_Dumbbell_Press'), ...fed(0, 'Dumbbell_Bench_Press')],
    side: [...fed(1, 'Incline_Dumbbell_Press'), ...fed(1, 'Dumbbell_Bench_Press')],
    steps: [
      '仰卧在上斜凳上（30-45°），双手持哑铃置于胸部两侧',
      '掌心朝前，哑铃与身体在同一平面，手肘约 45°',
      '垂直向上推起哑铃，重点感受上胸发力',
      '缓慢下放至上胸两侧，全幅度完成，避免拱腰借力',
    ],
  },
  杠铃卧推: {
    level: '中级',
    front: [...mw('male-barbell-bench-press-front'), ...feda('Barbell_Bench_Press_-_Medium_Grip')],
    side: [...mw('male-barbell-bench-press-side'), ...fed(1, 'Barbell_Bench_Press_-_Medium_Grip')],
    steps: [
      '仰卧在卧推凳上，眼睛正对杠铃，肩胛骨后收收紧',
      '双手握杠略宽于肩，双脚踩实地面，臀部贴凳',
      '控制杠铃下放至胸口（乳头附近），手肘约 45°',
      '发力推起至起始位置，顶端不锁死，全程有控制',
    ],
  },
  毛巾飞鸟: {
    level: '初级',
    front: [...fed(0, 'Dumbbell_Flyes')],
    side: [...fed(1, 'Dumbbell_Flyes')],
    steps: [
      '仰卧在瑜伽垫上，双手各握毛巾一端横跨胸前（模拟哑铃飞鸟）',
      '双手向两侧打开，主动收紧胸部，毛巾保持张力',
      '打开到手臂与身体约同一平面，感受胸部拉伸',
      '胸部发力把双手合拢回起始位置，顶端挤压胸部',
    ],
  },
  绳索飞鸟: {
    level: '中级',
    front: [...fed(0, 'Dumbbell_Flyes')],
    side: [...fed(1, 'Dumbbell_Flyes')],
    steps: [
      '把绳索滑轮调到高位或中位，双手握把手前倾站立',
      '双臂微屈固定，身体略前倾，核心收紧',
      '向胸前画弧合拢把手，顶端挤压胸部 1 秒',
      '缓慢回到两侧，感受胸部拉伸，重量宁轻勿假',
    ],
  },

  // ===== 背部（引体 / 下拉 / 划船 / 徒手上背） =====
  引体向上: {
    level: '中级',
    front: [...mw('male-bodyweight-pullup-front'), ...feda('Pullups')],
    side: [...mw('male-bodyweight-pullup-side'), ...fed(1, 'Pullups')],
    steps: [
      '双手正握单杠，略宽于肩，身体自然下垂',
      '肩胛骨先下沉后收，启动背部发力',
      '把胸口拉向单杠，手肘向身体两侧划',
      '缓慢下放至手臂伸直，避免借力甩动；练不了可用弹力带辅助',
    ],
  },
  高位下拉: {
    level: '中级',
    front: [...mw('male-machine-pulldown-front'), ...fed(0, 'Wide-Grip_Lat_Pulldown')],
    side: [...mw('male-machine-pulldown-side'), ...fed(1, 'Wide-Grip_Lat_Pulldown')],
    steps: [
      '坐在下拉机，双腿固定，双手宽握把手',
      '挺胸收腹，身体略后倾，肩胛骨先下沉',
      '把把手拉向下胸口，手肘向身体两侧划',
      '顶端挤压背部 1 秒，缓慢放回，手臂伸直但肩膀不上耸',
    ],
  },
  杠铃划船: {
    level: '中级',
    front: [...mw('male-barbell-bent-over-row-front'), ...feda('Bent_Over_Barbell_Row')],
    side: [...mw('male-barbell-bent-over-row-side'), ...fed(1, 'Bent_Over_Barbell_Row')],
    steps: [
      '双手握杠略宽于肩，屈髋俯身约 45°，背部平直',
      '杠铃悬于大腿前下方，核心收紧',
      '把杠铃拉向腹部，手肘贴近身体向后划',
      '顶端收缩背部 1 秒，缓慢下放，避免弓腰和借力',
    ],
  },
  '俯卧 Y-T-W': {
    level: '初级',
    front: [...feda('Superman')],
    side: [...fed(1, 'Superman')],
    mediaLabels: ['超人式（近似）', '超人式侧面'],
    steps: [
      '俯卧在瑜伽垫上，双手向前伸直，拇指朝上',
      '肩胛骨下沉后收，把手臂抬离地面呈 Y 字形',
      '顶端停顿 1-2 秒，感受肩胛骨之间收缩',
      '缓慢下放，再做 T 字（双臂平举）和 W 字（屈肘）变体，全程不耸肩',
    ],
  },
  超人式: {
    level: '初级',
    front: [...feda('Superman')],
    side: [...fed(1, 'Superman')],
    steps: [
      '俯卧在瑜伽垫上，双手向前伸直，双腿并拢',
      '同时抬起双手和双脚，胸口和大腿抬离地面',
      '顶端停顿 1-2 秒，收紧下背和臀部',
      '缓慢下放，不要猛烈弹振，全程保持呼吸',
    ],
  },
  反向雪天使: {
    level: '初级',
    front: [...feda('Superman')],
    side: [...fed(1, 'Superman')],
    steps: [
      '俯卧在瑜伽垫上，额头贴地，双手放体侧掌心朝下',
      '双手和前臂抬离地面，沿体侧向脚的方向划动',
      '划到底部再回到起始位置，模拟"雪天使"动作',
      '全程肩胛骨下沉后收，感受上背收缩，不耸肩',
    ],
  },
  俯身哑铃反向飞鸟: {
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

  // ===== 肩部 =====
  侧平举: {
    level: '初级',
    front: [...mw('male-dumbbell-lateral-raise-front', 'male-Dumbbells-dumbbell-lateral-raise-front'), ...feda('Side_Lateral_Raise'), ...fed(0, 'Dumbbell_Raise')],
    side: [...mw('male-dumbbell-lateral-raise-side', 'male-Dumbbells-dumbbell-lateral-raise-side'), ...fed(1, 'Side_Lateral_Raise'), ...fed(1, 'Dumbbell_Raise')],
    steps: [
      '站立，双手持哑铃（或装满水的水瓶）垂于体侧，手肘微屈',
      '向两侧举起手臂，到与肩同高即可',
      '想象"倒水"姿势，小指略高于拇指',
      '慢上慢下，不要耸肩借力；肩部不适时减小幅度和重量',
    ],
  },
  折刀俯卧撑: {
    level: '中级',
    front: [...feda('Incline_Push-Up'), ...fed(0, 'Handstand_Push-Ups')],
    side: [...fed(1, 'Incline_Push-Up'), ...fed(1, 'Handstand_Push-Ups')],
    steps: [
      '从下犬式开始，双手撑地略宽于肩，臀部高抬成倒 V 字',
      '头部正对双手之间，重心前移',
      '屈肘让头顶向地面下放，手肘向两侧打开',
      '发力推回起始位置，主要感受肩部发力',
    ],
  },
  靠墙倒立撑: {
    level: '中级',
    front: [...fed(0, 'Handstand_Push-Ups')],
    side: [...fed(1, 'Handstand_Push-Ups')],
    steps: [
      '面对墙双手撑地，双腿蹬上墙成倒立，双手与肩同宽',
      '核心收紧，身体保持一条直线，避免塌腰',
      '屈肘缓慢下放，头顶向地面靠近',
      '发力推回起始位置；力量不足可先做离心（缓慢下放）阶段',
    ],
  },
  俯身哑铃侧平举: {
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
  '杠铃/哑铃肩上推举': {
    level: '中级',
    front: [...mw('male-Dumbbells-dumbbell-overhead-press-front', 'male-dumbbell-shoulder-press-front'), ...fed(0, 'Dumbbell_Shoulder_Press')],
    side: [...mw('male-Dumbbells-dumbbell-overhead-press-side', 'male-dumbbell-shoulder-press-side'), ...fed(1, 'Dumbbell_Shoulder_Press')],
    steps: [
      '双手持杠铃或哑铃，举到肩部高度，掌心朝前',
      '核心收紧，腰背不要过度后仰',
      '呼气发力，垂直向上推起至手臂伸直',
      '顶端不要锁死手肘，缓慢下放回肩部',
    ],
  },
  肩上推举: {
    level: '中级',
    front: [...mw('male-Dumbbells-dumbbell-overhead-press-front', 'male-dumbbell-shoulder-press-front'), ...fed(0, 'Dumbbell_Shoulder_Press')],
    side: [...mw('male-Dumbbells-dumbbell-overhead-press-side', 'male-dumbbell-shoulder-press-side'), ...fed(1, 'Dumbbell_Shoulder_Press')],
    steps: [
      '双手持杠铃或哑铃，举到肩部高度，掌心朝前',
      '核心收紧，腰背不要过度后仰',
      '呼气发力，垂直向上推起至手臂伸直',
      '顶端不要锁死手肘，缓慢下放回肩部',
    ],
  },
  反向飞鸟: {
    level: '中级',
    front: [...mw('male-dumbbell-rear-delt-fly-front', 'male-Dumbbells-dumbbell-rear-delt-fly-front'), ...fed(0, 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench')],
    side: [...mw('male-dumbbell-rear-delt-fly-side', 'male-Dumbbells-dumbbell-rear-delt-fly-side'), ...fed(1, 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench')],
    steps: [
      '双手持轻哑铃，屈髋俯身，背部平直',
      '手肘微屈，双臂自然下垂',
      '向两侧打开到肩高，专注三角肌后束收缩',
      '缓慢下放，重量宁轻勿假',
    ],
  },

  // ===== 手臂 =====
  哑铃三头臂屈伸: {
    level: '初级',
    front: [...feda('Standing_Dumbbell_Triceps_Extension')],
    side: [...fed(1, 'Standing_Dumbbell_Triceps_Extension')],
    steps: [
      '站立或坐姿，双手托住一只哑铃顶端，举过头顶',
      '大臂贴近耳朵保持固定，手肘指向天花板',
      '屈肘把哑铃下放到脑后，感受三头拉伸',
      '发力把哑铃举回头顶，大臂全程不动',
    ],
  },
  哑铃颈后臂屈伸: {
    level: '初级',
    front: [...feda('Standing_Dumbbell_Triceps_Extension')],
    side: [...fed(1, 'Standing_Dumbbell_Triceps_Extension')],
    steps: [
      '坐姿或站立，单手或双手持哑铃举过头顶',
      '大臂贴近耳朵保持固定不动',
      '屈肘把哑铃下放到脑后，感受三头拉伸',
      '三头发力把哑铃举回顶端，避免手肘外展',
    ],
  },
  绳索下压: {
    level: '初级',
    front: [...mw('male-Cables-cable-push-down-front'), ...feda('Triceps_Pushdown'), ...fed(0, 'Triceps_Pushdown_-_Rope_Attachment')],
    side: [...mw('male-Cables-cable-push-down-side'), ...fed(1, 'Triceps_Pushdown'), ...fed(1, 'Triceps_Pushdown_-_Rope_Attachment')],
    steps: [
      '面向绳索机站立，双手握把手置于胸前，大臂贴紧身体',
      '核心收紧，身体不要前倾借力',
      '大臂不动，三头发力把把手下压至手臂伸直',
      '顶端收缩三头 1 秒，缓慢放回；手肘全程不离开体侧',
    ],
  },
  牧师椅弯举: {
    level: '初级',
    front: [...feda('Preacher_Curl')],
    side: [...fed(1, 'Preacher_Curl')],
    steps: [
      '坐在牧师椅前，大臂贴紧斜垫，双手握杠（或哑铃）',
      '大臂固定在垫上不动，肩膀放松',
      '屈肘把重量弯举向上，顶端收缩二头 1 秒',
      '缓慢下放至手臂伸直，全程大臂不离垫',
    ],
  },
  杠铃弯举: {
    level: '初级',
    front: [...feda('Barbell_Curl')],
    side: [...fed(1, 'Barbell_Curl')],
    steps: [
      '站立，双手反握杠铃与肩同宽，大臂贴紧身体',
      '大臂固定不动，肩膀放松下沉',
      '屈肘把杠铃弯举向肩部，顶端收缩二头 1 秒',
      '缓慢下放 2-3 秒，不要用身体甩动借力',
    ],
  },
  窄距俯卧撑: {
    level: '中级',
    front: [...feda('Push-Ups_-_Close_Triceps_Position'), ...fed(0, 'Pushups')],
    side: [...fed(1, 'Push-Ups_-_Close_Triceps_Position'), ...fed(1, 'Pushups')],
    steps: [
      '双手撑地位于胸部正下方，比肩略窄，食指拇指相对成菱形',
      '身体从头到脚成一条直线，核心收紧',
      '屈肘下放，手肘贴近身体向后，胸部靠近双手',
      '发力推回起始位置，主要感受三头发力',
    ],
  },
  毛巾弯举: {
    level: '初级',
    front: [...feda('Dumbbell_Bicep_Curl'), ...fed(0, 'Hammer_Curls')],
    side: [...fed(1, 'Dumbbell_Bicep_Curl'), ...fed(1, 'Hammer_Curls')],
    steps: [
      '站立，双手抓毛巾两端，一脚踩毛巾中段',
      '大臂贴紧身体固定，肩膀下沉',
      '屈肘把毛巾向上拉（等长收缩），顶端收缩二头 1-2 秒',
      '缓慢放回；可通过改变踩踏位置或毛巾张力调节难度',
    ],
  },

  // ===== 核心 =====
  死虫式: {
    level: '初级',
    front: [...mw('male-Bodyweight-dead-bug-front'), ...feda('Dead_Bug')],
    side: [...mw('male-Bodyweight-dead-bug-side'), ...fed(1, 'Dead_Bug')],
    steps: [
      '仰卧，双臂垂直伸向天花板，双腿屈膝抬起成 90°',
      '下背贴紧地面，腰部不要悬空',
      '对侧手脚同时缓慢伸出（如右手+左腿），接近地面但不触碰',
      '收回起始位置，换另一侧；全程保持下背贴地、核心收紧',
    ],
  },
  俄罗斯转体: {
    level: '初级',
    front: [...mw('male-bodyweight-russian-twist-front'), ...feda('Russian_Twist')],
    side: [...fed(1, 'Russian_Twist')],
    steps: [
      '坐姿，双膝弯曲，脚跟轻触或抬离地面，身体略后倾',
      '双手持哑铃或相交于胸前（自重版）',
      '躯干向一侧扭转，把重量带到髋侧，再转向另一侧',
      '左右交替，全程控制节奏，感受腹部旋转发力',
    ],
  },
  负重卷腹: {
    level: '初级',
    front: [...mw('male-bodyweight-crunch-front'), ...feda('Crunches')],
    side: [...mw('male-bodyweight-crunch-side'), ...fed(1, 'Crunches')],
    steps: [
      '仰卧屈膝，双脚平放地面，双手持哑铃/杠铃片置于胸前',
      '下背贴地，手轻扶重量不要离开身体',
      '呼气卷起上背部，把重量带向大腿，顶端收缩腹部',
      '缓慢下放，下背保持贴地，不要用手推重量',
    ],
  },
  悬垂举腿: {
    level: '中级',
    front: [...feda('Hanging_Leg_Raise')],
    side: [...fed(1, 'Hanging_Leg_Raise')],
    steps: [
      '双手正握单杠，身体自然下垂，肩胛骨下沉',
      '核心收紧，腹部发力把双腿抬起至与地面平行或更高',
      '顶端控制 1 秒，避免身体晃动借力',
      '缓慢下放至起始位置；力量不足可先做屈膝版',
    ],
  },
  绳索卷腹: {
    level: '初级',
    front: [...mw('male-bodyweight-crunch-front'), ...feda('Crunches')],
    side: [...mw('male-bodyweight-crunch-side'), ...fed(1, 'Crunches')],
    steps: [
      '跪姿面对绳索机，双手握绳索把手置于头侧',
      '臀部保持固定，髋部微屈',
      '腹部发力卷起上背部，把把手拉向大腿',
      '顶端收缩腹部 1 秒，缓慢放回，手臂只起连接作用',
    ],
  },

  // ===== 伤病替代动作 =====
  靠墙静蹲: {
    level: '初级',
    front: [...fed(0, 'Bodyweight_Squat')],
    side: [...fed(1, 'Bodyweight_Squat')],
    steps: [
      '背靠墙站立，双脚向前迈出约一步距离',
      '沿墙缓慢下蹲，直到大腿与地面平行（膝盖不超过 90°）',
      '背部贴墙，膝盖在脚踝正上方，不要超过脚尖',
      '保持静止 30-45 秒，膝盖不适时减小下蹲角度',
    ],
  },
  轻量侧平举: {
    level: '初级',
    front: [...mw('male-dumbbell-lateral-raise-front', 'male-Dumbbells-dumbbell-lateral-raise-front'), ...feda('Side_Lateral_Raise')],
    side: [...mw('male-dumbbell-lateral-raise-side', 'male-Dumbbells-dumbbell-lateral-raise-side'), ...fed(1, 'Side_Lateral_Raise')],
    steps: [
      '站立，双手持轻哑铃（或水瓶）垂于体侧',
      '小幅向两侧抬起，到与肩高 70% 即可，不追求大幅度',
      '手肘微屈，慢速控制，肩部有不适立即停止',
      '缓慢下放，组间充分休息，肩伤恢复期以无痛为第一原则',
    ],
  },

  // ===== 拉伸对齐（修掉空格 bug 后，与 STRETCH_PREFIX + "静态拉伸" 对齐） =====
  肩部静态拉伸: {
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
  手臂静态拉伸: {
    level: '初级',
    front: [...feda('Triceps_Stretch'), ...fed(0, 'Standing_Biceps_Stretch')],
    side: [...feda('Standing_Biceps_Stretch'), ...fed(1, 'Triceps_Stretch')],
    mediaLabels: ['三头拉伸', '二头拉伸'],
    steps: [
      '三头拉伸：一手举过头顶屈肘摸向对侧肩胛，另一手轻压手肘，每侧 20-30 秒',
      '二头拉伸：手臂伸直向后打开、掌心朝前，可扶墙固定',
      '每侧 20-30 秒，肩膀保持下沉不要耸肩',
      '全程缓慢呼吸，拉伸到有牵拉感但不疼痛',
    ],
  },
  腿部静态拉伸: {
    level: '初级',
    front: [...feda('Quad_Stretch'), ...fed(0, 'Hamstring_Stretch')],
    side: [...feda('Hamstring_Stretch'), ...fed(1, 'Quad_Stretch')],
    mediaLabels: ['大腿前侧', '腘绳肌'],
    steps: [
      '大腿前侧（股四头）：单腿站立，手抓另一脚脚背拉向臀部，每侧 20-30 秒',
      '腘绳肌（大腿后侧）：坐姿一腿前伸，身体前倾去够脚尖，每侧 20-30 秒',
      '每个动作静态保持，不要弹振',
      '拉伸到有明显牵拉感但不疼痛，配合缓慢深呼吸',
    ],
  },
  核心静态拉伸: {
    level: '初级',
    front: [...feda('Cat_Stretch'), ...fed(0, 'Childs_Pose')],
    side: [...feda('Childs_Pose'), ...fed(1, 'Cat_Stretch')],
    mediaLabels: ['猫式', '婴儿式'],
    steps: [
      '猫式：四点跪姿，吸气塌腰抬头，呼气拱背低头，做 8-10 次',
      '婴儿式：跪坐，双手前伸趴下，臀部坐向脚跟，保持 30 秒',
      '感受整个腰背的舒展和放松',
      '全程配合缓慢深呼吸，不要憋气',
    ],
  },
  上肢静态拉伸: {
    level: '初级',
    front: [...feda('Behind_Head_Chest_Stretch'), ...fed(0, 'Upper_Back_Stretch')],
    side: [...feda('Upper_Back_Stretch'), ...fed(1, 'Behind_Head_Chest_Stretch')],
    mediaLabels: ['胸部拉伸', '上背拉伸'],
    steps: [
      '胸部拉伸：双手在头后交扣，手肘向后打开，挺胸感受胸部牵拉，保持 20-30 秒',
      '上背拉伸：双臂前伸、双手交扣，含胸拱背把肩胛撑开，保持 20-30 秒',
      '两个动作交替进行，舒展整个上肢',
      '全程缓慢呼吸，肩膀保持下沉',
    ],
  },
  全身静态拉伸: {
    level: '初级',
    front: [...feda('Worlds_Greatest_Stretch'), ...fed(0, 'Chest_And_Front_Of_Shoulder_Stretch')],
    side: [...feda('Chest_And_Front_Of_Shoulder_Stretch'), ...fed(1, 'Worlds_Greatest_Stretch')],
    mediaLabels: ['世界最伟大拉伸', '胸肩拉伸'],
    steps: [
      '每个部位保持 20-30 秒，全程缓慢深呼吸',
      '配合"世界最伟大拉伸"活动髋部与胸椎',
      '胸肩：双手背后交扣，挺胸抬臂，感受胸部和肩前束牵拉',
      '拉伸到有明显牵拉感但不疼痛的程度即可',
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
