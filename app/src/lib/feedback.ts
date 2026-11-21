/**
 * 意见反馈的纯文本拼装（T3）。
 * 不引入后端：内容经 mailto: 交给系统邮件客户端，或复制到剪贴板由用户自行粘贴。
 * 保持纯函数，便于单测覆盖编码与联系方式拼接。
 */

export const FEEDBACK_EMAIL = '1443608354@qq.com'
export const FEEDBACK_MAX_LENGTH = 500
export const CONTACT_MAX_LENGTH = 60
export const MIN_FEEDBACK_LENGTH = 5

/** 邮件正文与复制内容共用一份，保证两个入口拿到的内容完全一致 */
export function buildFeedbackBody(text: string, contact = '', host = ''): string {
  const parts = [text.trim()]
  const trimmedContact = contact.trim()
  if (trimmedContact) parts.push(`\n\n联系方式：${trimmedContact}`)
  parts.push(`\n\n—— 来自 ${host || 'FitUp'}`)
  return parts.join('')
}

/** 供 window.open 使用的 mailto: URL（不用 location.href，便于测试断言） */
export function feedbackMailto(text: string, contact = '', host = ''): string {
  const subject = encodeURIComponent('FitUp 反馈')
  const body = encodeURIComponent(buildFeedbackBody(text, contact, host))
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`
}
