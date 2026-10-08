export const SUPPORTED_LOCALES = ['zh-CN', 'en-US', 'vi-VN'] as const

export type Locale = typeof SUPPORTED_LOCALES[number]
export type MessageParams = Record<string, string | number>
