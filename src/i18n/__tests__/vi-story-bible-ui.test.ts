import { describe, expect, it } from 'vitest'
import { localize } from '../core'
describe('Vietnamese story bible and author-workflow UI', () => {
 it('translates the complete author clue list shown in the pilot', () => {
  for (const [en,vi] of [
   ['Plan list','Danh sách manh mối'],['New plan','Thêm manh mối'],
   ['Setup / start chapter','Chương gieo manh mối / bắt đầu'],
   ['Save plan','Lưu manh mối'],
   ['No foreshadowing or narrative threads yet','Chưa có manh mối hoặc tuyến tình tiết'],
  ]) expect(localize('vi-VN','',en)).toBe(vi)
 })
 it('preserves English and Chinese choice without changing saved project language', () => {
  expect(localize('en-US','', 'Plan list')).toBe('Plan list')
  expect(localize('zh-CN','计划清单','Plan list')).toBe('计划清单')
 })
 it('translates other workflow actions', () => {
  expect(localize('vi-VN','', 'Batch write')).toBe('Viết nhiều chương')
  expect(localize('vi-VN','', 'Task history')).toBe('Lịch sử tác vụ')
 })
})
