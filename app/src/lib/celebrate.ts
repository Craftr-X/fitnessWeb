import confetti from 'canvas-confetti'

const COLORS = ['#f97316', '#10b981', '#38bdf8', '#facc15', '#f472b6', '#a78bfa']

/** 勾选单个动作时：在点击位置放一小束彩带 */
export function burstAt(clientX: number, clientY: number) {
  confetti({
    particleCount: 60,
    spread: 70,
    startVelocity: 28,
    scalar: 0.9,
    ticks: 120,
    origin: {
      x: clientX / window.innerWidth,
      y: clientY / window.innerHeight,
    },
    colors: COLORS,
    disableForReducedMotion: true,
  })
}

/** 一整天全部完成时：从两侧放一大束彩带 */
export function celebrateDayDone() {
  const opts = {
    particleCount: 90,
    spread: 100,
    startVelocity: 40,
    colors: COLORS,
    disableForReducedMotion: true,
  }
  confetti({ ...opts, angle: 60, origin: { x: 0, y: 0.7 } })
  confetti({ ...opts, angle: 120, origin: { x: 1, y: 0.7 } })
}

/** 完成整周计划时：持续约 1.6 秒的烟花 */
export function celebrateWeekDone() {
  const duration = 1600
  const end = Date.now() + duration

  const frame = () => {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 60,
      startVelocity: 55,
      origin: { x: 0, y: 0.8 },
      colors: COLORS,
      disableForReducedMotion: true,
    })
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 60,
      startVelocity: 55,
      origin: { x: 1, y: 0.8 },
      colors: COLORS,
      disableForReducedMotion: true,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}
