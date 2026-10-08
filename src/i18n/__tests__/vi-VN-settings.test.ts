import { describe, expect, it } from 'vitest'
import { localize } from '../core'
import { viSettings } from '../vi-settings'

const expectedSections = [
  'Appearance',
  'Generation models',
  'Embedding model',
  'Network proxy',
  'Editor',
  'Prompt templates',
  'Writing skills',
  'About',
] as const

function placeholders(input: string): string[] {
  return Array.from(input.matchAll(/\{([a-zA-Z_]\w*)\}/g), match => match[1]).sort()
}

describe('Vietnamese settings copy', () => {
  it('translates every settings section title', () => {
    for (const name of expectedSections) {
      expect(viSettings[name]).toBeTruthy()
      expect(localize('vi-VN', '中文占位', name)).toBe(viSettings[name])
    }
  })

  it('translates main model, prompt, skill and editor controls', () => {
    expect(localize('vi-VN', '创建模型', 'New model configuration')).toBe('Cấu hình mô hình AI mới')
    expect(localize('vi-VN', '代理类型', 'Proxy type')).toBe('Loại proxy')
    expect(localize('vi-VN', '创作角色定位', 'Creative role')).toBe('Vai trò sáng tác của AI')
    expect(localize('vi-VN', '写作字体', 'Writing font')).toBe('Phông chữ soạn thảo')
    expect(localize('vi-VN', '技能库', 'Skill library')).toBe('Thư viện kỹ năng')
  })

  it('preserves existing English and Chinese strings', () => {
    expect(localize('en-US', '设置', 'Settings')).toBe('Settings')
    expect(localize('zh-CN', '设置', 'Settings')).toBe('设置')
  })

  it('keeps named placeholders intact in translated settings strings', () => {
    for (const [original, translated] of Object.entries(viSettings)) {
      expect(translated.trim(), original).not.toBe('')
      expect(placeholders(translated), original).toEqual(placeholders(original))
    }
    expect(localize('vi-VN', '连接失败', 'Connection failed: {error}', { error: '401' }))
      .toBe('Kết nối thất bại: 401')
  })
})
