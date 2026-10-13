'use strict'
/** SSR Reader is an isolated TXT viewer: it cannot open Writer projects or SQLite. */
const path = require('node:path')
const MAX_CHAPTERS = 1500
const MAX_CHAPTER_BYTES = 4 * 1024 * 1024
const MAX_IMPORT_BYTES = 160 * 1024 * 1024
const safeId = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
function bookTitle(value) {
  if (typeof value !== 'string') return 'Tác phẩm của tôi'
  const title = value.trim().replace(/[\r\n\t<>]/g, ' ').slice(0, 100)
  return title || 'Tác phẩm của tôi'
}
function chapterNumber(fileName) {
  const stem = path.basename(fileName).replace(/\.txt$/i, '').trim()
  const match = stem.match(/^(?:chương|chapter)\s*0*(\d{1,5})(?!\d)/iu)
    || stem.match(/^第\s*0*(\d{1,5})\s*章/u)
    || stem.match(/^0*(\d{1,5})[\s._-]+/u)
  const number = match ? Number(match[1]) : null
  return number && Number.isSafeInteger(number) && number <= 99999 ? number : null
}
function cleanChapterTitle(fileName) {
  const stem = path.basename(fileName).replace(/\.txt$/i,'').trim()
  return stem.replace(/^(?:(?:chương|chapter)\s*\d+\s*[-:.·_]?\s*|第\s*\d+\s*章\s*[-:.·_]?\s*|\d+\s*[-:.·_]\s*)/iu,'').trim().slice(0,140)
}
function prepareChapterFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_CHAPTERS) {
    throw new Error('Hãy chọn từ 1 đến 1.500 tệp TXT.')
  }
  const seen = new Set()
  return files.map((fileName, index) => {
    if (typeof fileName !== 'string' || path.extname(fileName).toLowerCase() !== '.txt') {
      throw new Error('Chỉ hỗ trợ tệp .txt.')
    }
    const number = chapterNumber(fileName) ?? index + 1
    if (seen.has(number)) throw new Error('Trùng số chương ' + number + '. Hãy kiểm tra tên tệp trước khi nhập.')
    seen.add(number)
    return { source: fileName, number, title: cleanChapterTitle(fileName) }
  }).sort((a,b) => a.number - b.number || a.title.localeCompare(b.title,'vi'))
}
function safePlainText(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength > MAX_CHAPTER_BYTES) throw new Error('Chương vượt giới hạn 4 MB.')
  const value = new TextDecoder('utf-8', { fatal:true }).decode(buffer).replace(/^\uFEFF/u, '')
  if (!value.trim() || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value)) {
    throw new Error('Tệp phải là văn bản UTF-8 thuần, không có dữ liệu nhị phân.')
  }
  return value.replace(/\r\n?/g, '\n')
}
function clampFraction(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : 0
}
function normalizeProgress(input) {
  const existing = input && typeof input === 'object' ? input : {}
  const marks = Array.isArray(existing.bookmarks)
    ? [...new Set(existing.bookmarks.filter(v=>typeof v==='number'&&Number.isFinite(v))
      .map(v=>clampFraction(v).toFixed(4)))].slice(0,50).map(Number).sort((a,b)=>a-b) : []
  return { position:clampFraction(existing.position), bookmarks:marks }
}
module.exports = { MAX_CHAPTERS, MAX_CHAPTER_BYTES, MAX_IMPORT_BYTES, safeId, bookTitle, chapterNumber,
  prepareChapterFiles, safePlainText, clampFraction, normalizeProgress }
