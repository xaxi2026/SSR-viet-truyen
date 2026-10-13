import { describe, expect, it } from 'vitest'
import { localize } from '../core'
describe('Vietnamese critical author confirmations', () => {
  it('keeps the exact project name while translating deletion warning', () => {
    const english = 'Delete project Truyện Thử Nghiệm\nThis removes its manuscripts, architecture, characters, blueprints, knowledge base, and all project data.'
    const vietnamese = localize('vi-VN', '', english)
    expect(vietnamese).toContain('Xóa dự án Truyện Thử Nghiệm?')
    expect(vietnamese).toContain('toàn bộ dữ liệu dự án')
    expect(localize('en-US', '', english)).toBe(english)
  })
  it('warns before deleting draft or just removing a recent-project shortcut', () => {
    expect(localize('vi-VN', '', 'Delete Chapter 4 v1.2\nThis permanently removes the draft and related review/revision artifacts.')).toContain('xóa vĩnh viễn')
    expect(localize('vi-VN', '', 'Remove Demo from recent projects?\nThis only removes the list entry and does not delete project files.')).toContain('không xóa tệp dự án')
  })
  it('does not rewrite an unknown string or stored story prose', () => {
    const passage = 'Kiếm Tôn nhìn lên thiên mệnh rồi quay lưng bỏ đi.'
    expect(localize('vi-VN','', passage)).toBe(passage)
  })
})
