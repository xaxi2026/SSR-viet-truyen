'use strict'
const {test} = require('node:test')
const assert = require('node:assert/strict')
const {chapterNumber,bookTitle,prepareChapterFiles,safePlainText,clampFraction,
  normalizeProgress,safeId,MAX_CHAPTERS} = require('../reader-core.cjs')
const fake = n=>'C:/test/第'+n+'章 Tiêu đề '+n+'.txt'
test('recognizes finalized TXT file numbers in Windows names',()=>{
  assert.equal(chapterNumber(fake(1)),1)
  assert.equal(chapterNumber('Chương 150 - Đoạn kết.txt'),150)
  assert.equal(chapterNumber('chapter 007 Something.txt'),7)
  assert.equal(chapterNumber('001 - first.txt'),1)
  assert.equal(chapterNumber('manual.txt'),null)
})
test('sorts chapters numerically and never puts chapter 10 before 2',()=>{
  assert.deepEqual(prepareChapterFiles([fake(10),fake(2),fake(1)]).map(x=>x.number),[1,2,10])
})
test('rejects duplicate chapter numbers and unsupported extensions',()=>{
  assert.throws(()=>prepareChapterFiles([fake(2),fake(2)]),/Trùng/)
  assert.throws(()=>prepareChapterFiles(['C:/file.db']),/txt/)
  assert.throws(()=>prepareChapterFiles([]))
  assert.throws(()=>prepareChapterFiles(Array.from({length:MAX_CHAPTERS+1},()=>fake(1))))
})
test('imports Vietnamese UTF-8 plain text and preserves punctuation',()=>{
  assert.equal(safePlainText(Buffer.from('Chương 1\r\n\r\nNgọc bội nằm trên bàn.','utf8')), 'Chương 1\n\nNgọc bội nằm trên bàn.')
})
test('refuses binary bytes, malformed UTF-8, zero bytes and large content',()=>{
  assert.throws(()=>safePlainText(Buffer.from([0,2,45])),/văn bản/)
  assert.throws(()=>safePlainText(Buffer.from([255,254,250])),/encoded|encoding|valid/i)
  assert.throws(()=>safePlainText(Buffer.alloc(4*1024*1024+1,65)),/4 MB/)
})
test('parses cover-less metadata without paths/SQL/HTML execution',()=>{
  assert.equal(bookTitle('   Đọc truyện thử \n '),'Đọc truyện thử')
  assert.equal(safeId('../.vela'),false)
  assert.equal(safeId('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'),true)
})
test('clamps reading position and untrusted bookmarks',()=>{
  assert.equal(clampFraction(-8),0)
  assert.equal(clampFraction(Infinity),0)
  assert.equal(clampFraction(22),1)
  assert.deepEqual(normalizeProgress({position:.72,bookmarks:[.45,.45,1.2,-1,'bad']}),{position:.72,bookmarks:[0,.45,1]})
})
test('reading UI has no embedded Writer IPC or direct project access',()=>{
  const fs=require('node:fs'),path=require('node:path')
  const source=['main.cjs','reader.js','preload.cjs','index.html'].map(f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8')).join('\n')
  assert.equal(/require\(['"]\.\.\/\.\.\/electron|from ['"]\.\.\/\.\.\/src\/stores/.test(source),false)
  assert.equal(/(\.vela\/|sqlite3|openai|db:story-bible|db:narrative-thread|LLM_API_KEY)/iu.test(source),false)
  assert.match(source,/contextIsolation:true,nodeIntegration:false,sandbox:true/)
  assert.match(source,/connect-src 'none'/)
})

test('handles 500 synthetic chapters without lexical 10-before-2 ordering',()=>{
 const filenames=Array.from({length:500},(_,i)=>fake(500-i))
 const result=prepareChapterFiles(filenames)
 assert.equal(result.length,500)
 assert.deepEqual(result.map(x=>x.number),Array.from({length:500},(_,i)=>i+1))
})
