import { describe, expect, it } from 'vitest'
import { enUS } from '../messages/en-US'
import { viVN } from '../messages/vi-VN'

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{([a-zA-Z_]\w*)\}/g)].map(match => match[1]).sort()
}

describe('Vietnamese interface translation catalogue', () => {
  it('covers exactly the upstream English message keys', () => {
    expect(Object.keys(viVN).sort()).toEqual(Object.keys(enUS).sort())
  })

  it('preserves interpolation placeholders for every message', () => {
    for (const key of Object.keys(enUS) as Array<keyof typeof enUS>) {
      expect(viVN[key].trim()).not.toBe('')
      expect(placeholders(viVN[key])).toEqual(placeholders(enUS[key]))
    }
  })

  it('provides Vietnamese translations for common navigation', () => {
    expect(viVN['common.open']).toBe('Mở')
    expect(viVN['project.new']).toBe('Tạo dự án')
  })
})
