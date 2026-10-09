import { describe, expect, it } from 'vitest'
import { localize } from '../core'
import { viNovelConfig } from '../vi-novel-config'
import { AUDIENCE_EN, GENRE_EN } from '../../shared/novel-config-localization'

const REQUIRED = {
  'Novel configuration': 'Cấu hình truyện',
  'Basic information': 'Thông tin cơ bản',
  'Writing language': 'Ngôn ngữ viết truyện',
  'Genre': 'Thể loại',
  'Subgenre': 'Thể loại phụ',
  'Audience': 'Đối tượng độc giả',
  'Story structure': 'Cấu trúc truyện',
  'Point of view': 'Ngôi kể',
  'Total chapters': 'Tổng số chương',
  'Words per chapter': 'Số từ mỗi chương',
  'Quality and continuity': 'Chất lượng và tính nhất quán',
  'Core outline': 'Ý tưởng cốt lõi',
  'Protagonist profile': 'Hồ sơ nhân vật chính',
  'Foreshadowing & narrative threads': 'Tình tiết gợi mở và tuyến truyện',
} as const

const params = (text: string): string[] =>
  Array.from(text.matchAll(/\{([a-zA-Z_]\w*)\}/g), m => m[1]).sort()

describe('Vietnamese novel configuration and project navigation', () => {
  it('translates the main screen without altering en-US or zh-CN', () => {
    for (const [english, vietnamese] of Object.entries(REQUIRED)) {
      expect(localize('vi-VN', '占位文本', english)).toBe(vietnamese)
      expect(localize('en-US', '占位文本', english)).toBe(english)
      expect(localize('zh-CN', '中文标签', english)).toBe('中文标签')
    }
  })

  it('translates every built-in genre and audience display label', () => {
    for (const english of [...Object.values(GENRE_EN), ...Object.values(AUDIENCE_EN)]) {
      expect(viNovelConfig[english], english).toBeTruthy()
      expect(localize('vi-VN', '旧标签', english)).not.toBe(english)
    }
    expect(localize('vi-VN', '未知', 'Xianxia')).toBe('Tiên hiệp')
    expect(localize('vi-VN', '未知', 'Science fiction')).toBe('Khoa học viễn tưởng')
    expect(localize('vi-VN', '未知', 'Third-person limited')).toBe('Ngôi thứ ba giới hạn')
  })

  it('keeps placeholders and interpolates project chapter counts and confirmation content', () => {
    for (const [source, translation] of Object.entries(viNovelConfig)) {
      expect(translation.trim(), source).not.toBe('')
      expect(params(translation), source).toEqual(params(source))
    }
    expect(localize('vi-VN', '产品默认值：{count} 章', 'Product default: {count} chapters', { count: 3 }))
      .toBe('Giá trị mặc định: 3 chương')
    expect(localize('vi-VN', '当前生效值：{count} 章', 'Effective now: {count} chapters', { count: 5 }))
      .toBe('Đang áp dụng: 5 chương')
    expect(localize('vi-VN', '{done}/{total} 章', '{done}/{total} chapters', { done: 16, total: 100 }))
      .toBe('16/100 chương')
    expect(localize('vi-VN', '提示', '{count} drafts', { count: 2 })).toBe('2 bản nháp')
  })

  it('does not turn the application About tab into an estimated total label', () => {
    expect(localize('vi-VN', '关于', 'About')).toBe('Giới thiệu')
    expect(localize('vi-VN', '大约', 'Approximately')).toBe('Khoảng')
  })
})
