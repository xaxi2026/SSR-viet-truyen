import { enUS, type MessageKey } from './messages/en-US'
import { zhCN } from './messages/zh-CN'
import { viVN } from './messages/vi-VN'
import { viInline } from './vi-inline'
import type { Locale, MessageParams } from './types'

type Catalog = Record<string, string>

export const messages: Record<Locale, Catalog> = {
  'en-US': enUS,
  'zh-CN': zhCN,
  'vi-VN': viVN,
}

export function resolveLocale(input?: string | null): Locale {
  const lang = input?.toLowerCase() ?? ''
  if (lang.startsWith('vi')) return 'vi-VN'
  return lang.startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function createTranslator(catalogs: Partial<Record<Locale, Catalog>> & { 'en-US': Catalog }) {
  return (locale: Locale, key: string, params: MessageParams = {}): string => {
    const template = catalogs[locale]?.[key] ?? catalogs['en-US'][key] ?? key
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
  }
}

const translateMessage = createTranslator(messages)

function interpolate(template: string, params: MessageParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

/**
 * Localize short copy that belongs to a single component. Shared language uses
 * the keyed catalog above; colocating one-off copy keeps the catalog focused.
 */
export function localize(
  locale: Locale,
  zhCNText: string,
  enUSText: string,
  params?: MessageParams,
): string {
  const template = locale === 'zh-CN'
    ? zhCNText
    : locale === 'vi-VN' ? (viInline[enUSText] ?? enUSText) : enUSText
  return interpolate(template, params)
}

export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  return translateMessage(locale, key, params)
}

/** Temporary compatibility boundary for pre-Vietnamese writing-language workflows. */
export function legacyUiLocale(locale: Locale): 'zh-CN' | 'en-US' {
  return locale === 'zh-CN' ? 'zh-CN' : 'en-US'
}

export type { Locale, MessageKey, MessageParams }
