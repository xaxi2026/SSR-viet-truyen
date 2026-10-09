import { describe, expect, it } from 'vitest'
import { localize } from '../core'
import { viInline } from '../vi-inline'

describe('Vietnamese home-screen text', () => {
  const screenText: Record<string, string> = {
    'Home': 'Trang chủ',
    'Novel': 'Tiểu thuyết',
    'Cast': 'Nhân vật',
    'Plot': 'Dàn ý',
    'World': 'Thế giới',
    'Tasks': 'Tác vụ',
    'Logs': 'Nhật ký',
    'Model calls': 'Lượt gọi AI',
    'Welcome to AI Novel Writer': 'Chào mừng đến với SSR-viet truyen',
    'AI Writing Assistant': 'Trợ lý sáng tác AI',
    'Type a message, @ mention, or / use a workflow...': 'Nhập tin nhắn, dùng @ để nhắc đến hoặc / để gọi quy trình...',
  }

  it('provides Vietnamese labels visible on the welcome screen', () => {
    for (const [english, vietnamese] of Object.entries(screenText)) {
      expect(viInline[english]).toBe(vietnamese)
      expect(localize('vi-VN', 'legacy source', english)).toBe(vietnamese)
    }
  })

  it('preserves the previous English and Chinese interface', () => {
    expect(localize('en-US', '首页', 'Home')).toBe('Home')
    expect(localize('zh-CN', '首页', 'Home')).toBe('首页')
  })

  it('falls back to English for untranslated phrases', () => {
    expect(localize('vi-VN', '未知', 'An untranslated sentence')).toBe('An untranslated sentence')
  })
})
