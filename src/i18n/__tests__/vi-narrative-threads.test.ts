import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { localize } from '../core'

/** Guard every literal text(zh, en) used by the two existing plot panels. */
describe('Vietnamese plot-tree and narrative-thread UI', () => {
  it('translates the author-facing plan labels', () => {
    expect(localize('vi-VN', '计划清单', 'Plan list')).toBe('Danh sách manh mối')
    expect(localize('vi-VN', '新计划', 'New plan')).toBe('Thêm manh mối')
    expect(localize('vi-VN', '已埋设', 'Planted')).toBe('Đã gieo')
    expect(localize('vi-VN', '确认最终事件', 'Confirm finalized event')).toBe('Xác nhận sự kiện trong chương đã chốt')
  })

  it('preserves existing English and Chinese UI', () => {
    expect(localize('en-US', '计划清单', 'Plan list')).toBe('Plan list')
    expect(localize('zh-CN', '计划清单', 'Plan list')).toBe('计划清单')
  })

  it.each(['NarrativeThreadEditor.tsx', 'PlotTreeView.tsx'])(
    'has Vietnamese coverage for literal text() labels in %s', (name) => {
      const source = readFileSync(new URL(`../../components/editor/${name}`, import.meta.url), 'utf8')
      const textPairs = [...source.matchAll(/\\btext\\(\\s*'([^']*)'\\s*,\\s*'([^']*)'/g)]
      expect(textPairs.length).toBeGreaterThan(10)
      const untranslated = textPairs
        .map((match) => match[2])
        .filter((english): english is string => typeof english === 'string')
        .filter((english) => localize('vi-VN', '', english) === english)
      expect(untranslated).toEqual([])
    },
  )
})
