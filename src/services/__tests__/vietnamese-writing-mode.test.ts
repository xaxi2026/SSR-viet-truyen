import { describe, expect, it } from 'vitest'
import { getBuiltinPromptTemplate, composePromptSystemRole } from '../prompt-templates'
import {
  characterArchitecturePrompts,
  CORE_LOCALIZED_BUILTIN_PROMPT_KEYS,
} from '../prompt-language'
import { resolveWritingLanguage } from '../../shared/writing-language'
import { countDraftUnits, DRAFT_UNIT_ALGORITHM_VERSION } from '../../shared/draft-units'

function variables(s: string): string[] {
  return [...new Set(Array.from(s.matchAll(/\{\{([a-z0-9_]+)\}\}/giu), m => m[1]!))].sort()
}

describe('Vietnamese long-form writing mode', () => {
  it('resolves vi-VN but preserves legacy fallback for invalid values', () => {
    expect(resolveWritingLanguage('vi-VN')).toBe('vi-VN')
    expect(resolveWritingLanguage('en-US')).toBe('en-US')
    expect(resolveWritingLanguage('unrecognized')).toBe('zh-CN')
  })

  it.each(CORE_LOCALIZED_BUILTIN_PROMPT_KEYS)(
    'keeps immutable core JSON and variable contracts for %s', key => {
      const english = getBuiltinPromptTemplate(key, 'en-US')!
      const vietnamese = getBuiltinPromptTemplate(key, 'vi-VN')!
      expect(vietnamese.systemRole).toContain('TIẾNG VIỆT')
      expect(vietnamese.systemSuffix).toContain('TIẾNG VIỆT')
      expect(vietnamese.systemSuffix).toContain(english.systemSuffix ?? '')
      expect(variables(vietnamese.content + '\n' + vietnamese.systemSuffix))
        .toEqual(variables(english.content + '\n' + english.systemSuffix))
      expect(vietnamese.writingLanguage).toBe(english.writingLanguage)
    },
  )

  it('preserves Vietnamese writing instructions through a customized assistant role', () => {
    const role = composePromptSystemRole({ systemRole: 'Vai trò tùy chỉnh' }, 'vi-VN')
    expect(role).toContain('Vai trò tùy chỉnh')
    expect(role).toContain('tiếng Việt tự nhiên')
    expect(role).toContain('tên khóa JSON')
    expect(role).not.toContain('Write all generated story material and model-facing prose in English')
  })

  it('keeps character identities and JSON keys while requiring Vietnamese descriptions', () => {
    const vi = characterArchitecturePrompts('vi-VN')
    expect(vi.manifestSystem).toContain('tiếng Việt tự nhiên')
    expect(vi.manifestSystem).toContain('{"slots":[...]}')
    expect(vi.detailContract).toContain('slotId')
    expect(vi.detailContract).toContain('updatedAtChapter')
  })

  it('counts Vietnamese prose as Unicode word units with the existing persisted algorithm', () => {
    expect(DRAFT_UNIT_ALGORITHM_VERSION).toBe(3)
    expect(countDraftUnits('Tôi đang viết một câu chuyện dài bằng tiếng Việt.')).toBe(10)
    expect(countDraftUnits('tie\u0302\u0301ng Vie\u0323\u0302t')).toBe(2)
    expect(countDraftUnits(Array(2500).fill('truyện').join(' '))).toBe(2500)
  })
})
