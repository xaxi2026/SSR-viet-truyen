import { describe, expect, it } from 'vitest'
import { localize } from '../core'
import { localizeVietnameseDynamicUi } from '../vi-ui-patterns'
describe('dynamic UI localization is bounded to whitelisted system messages', () => {
  it('localizes foreshadowing and chapter identifiers', () => {
    expect(localize('vi-VN', '', 'Setup/start 9 · expected payoff/end 40')).toBe('Gieo chương 9 · giải đáp dự kiến chương 40')
    expect(localize('vi-VN', '', 'Chapter 40 finalized draft')).toBe('Bản thảo chương 40 đã chốt')
    expect(localize('vi-VN', '', 'Dormant 5 chapters')).toBe('Bỏ quên 5 chương')
  })
  it('preserves other locales and unknown prose as authored', () => {
    expect(localize('en-US', '第 9 章定稿', 'Chapter 9 finalized draft')).toBe('Chapter 9 finalized draft')
    expect(localize('zh-CN', '第 9 章定稿', 'Chapter 9 finalized draft')).toBe('第 9 章定稿')
    expect(localizeVietnameseDynamicUi('A silver sword glows in the moonlight.')).toBeUndefined()
  })
  it('localizes dynamic status and file counts', () => {
    expect(localize('vi-VN', '', 'Saved 8 character cards')).toBe('Đã lưu 8 hồ sơ nhân vật')
    expect(localize('vi-VN', '', '3 files selected')).toBe('Đã chọn 3 tệp')
  })
})
