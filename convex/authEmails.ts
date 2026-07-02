type AuthEmailTone = 'cyan' | 'coral'

export type AuthEmailTemplate = {
  html: string
  text: string
}

export type AuthEmailInput = {
  actionHref: string | null
  actionLabel: string | null
  code: string | null
  intro: string
  meta: string
  title: string
  tone: AuthEmailTone
}

const escapeHtml = (value: string): string => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const getAccent = (tone: AuthEmailTone): string => {
  if (tone === 'coral') {
    return '#ff615c'
  }
  return '#17d6e0'
}

const getActionText = (input: AuthEmailInput): string[] => {
  if (input.code) {
    return [`Code: ${input.code}`]
  }
  if (input.actionHref) {
    return [`${input.actionLabel ?? 'Open link'}: ${input.actionHref}`]
  }
  return []
}

export const renderAuthEmail = (input: AuthEmailInput): AuthEmailTemplate => {
  const accent = getAccent(input.tone)
  const actionText = getActionText(input)
  const codeMarkup = input.code
    ? `<div style="margin:28px 0;padding:18px 20px;border:1px solid ${accent};border-radius:8px;background:#06111f;color:#ffffff;font-size:32px;font-weight:900;letter-spacing:8px;text-align:center;">${escapeHtml(input.code)}</div>`
    : ''
  const buttonMarkup = input.actionHref
    ? `<a href="${escapeHtml(input.actionHref)}" style="display:block;margin:28px 0;padding:17px 20px;border-radius:8px;background:${accent};color:#ffffff;font-size:16px;font-weight:900;text-align:center;text-decoration:none;">${escapeHtml(input.actionLabel ?? 'Open link')}</a>`
    : ''

  return {
    html: [
      '<!doctype html>',
      '<html>',
      '<body style="margin:0;background:#050b14;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#f4f8ff;">',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;border-collapse:collapse;">',
      '<tr><td>',
      '<div style="border:1px solid #37506b;border-radius:8px;background:#0b1728;padding:34px 30px;box-shadow:0 24px 64px rgba(0,0,0,.32);">',
      '<div style="margin-bottom:26px;font-size:28px;font-weight:900;line-height:1;color:#ffffff;"><span style="color:#17d6e0;">A</span><span style="color:#ff615c;">X</span> Anime<span style="color:#ff615c;">X</span></div>',
      `<h1 style="margin:0 0 14px;color:#ffffff;font-size:30px;line-height:1.15;">${escapeHtml(input.title)}</h1>`,
      `<p style="margin:0;color:#b8c5d8;font-size:16px;line-height:1.65;">${escapeHtml(input.intro)}</p>`,
      codeMarkup,
      buttonMarkup,
      `<p style="margin:22px 0 0;color:#8ea0b8;font-size:14px;line-height:1.55;">${escapeHtml(input.meta)}</p>`,
      '<p style="margin:28px 0 0;color:#64748b;font-size:12px;line-height:1.5;">If you did not request this, you can ignore this email.</p>',
      '</div>',
      '</td></tr>',
      '</table>',
      '</body>',
      '</html>',
    ].join(''),
    text: [
      'AnimeX',
      '',
      input.title,
      '',
      input.intro,
      '',
      ...actionText,
      '',
      input.meta,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
  }
}
