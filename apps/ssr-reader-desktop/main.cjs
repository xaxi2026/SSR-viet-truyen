'use strict'
const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { safeId, bookTitle, prepareChapterFiles, safePlainText,
  MAX_CHAPTER_BYTES, MAX_IMPORT_BYTES, normalizeProgress } = require('./reader-core.cjs')

app.setName('SSR Reader')
// Test-only storage override: never run automated cases against the user's library.
if (process.env.SSR_READER_E2E_HOME) {
  const os = require('node:os')
  const home = path.resolve(process.env.SSR_READER_E2E_HOME)
  const tempRoot = path.resolve(os.tmpdir()) + path.sep
  if (!home.toLowerCase().startsWith(tempRoot.toLowerCase()) ||
      !path.basename(home).startsWith('ssr-reader-smoke-')) {
    throw new Error('Unsafe E2E profile location')
  }
  const profile = path.join(home, 'reader-profile')
  fs.mkdirSync(profile, { recursive: true })
  app.setPath('userData', profile)
}
let readerWindow
let libraryRoot

function atomicJson(file, value) {
  const temp = file + '.' + randomUUID() + '.tmp'
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { encoding:'utf8', flag:'wx' })
  fs.renameSync(temp, file)
}
function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback
  const stat = fs.statSync(file)
  if (stat.size > 3 * 1024 * 1024) throw new Error('Dữ liệu thư viện bất thường.')
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
const libraryFile = () => path.join(libraryRoot, 'library.json')
const positionFile = () => path.join(libraryRoot, 'positions.json')
function books() {
  const json = readJson(libraryFile(), [])
  if (!Array.isArray(json) || json.length > 500) throw new Error('Thư viện không hợp lệ.')
  return json.filter(b => safeId(b?.id) && typeof b.title === 'string' && Array.isArray(b.chapters))
}
function findBook(id) {
  if (!safeId(id)) throw new Error('Mã sách không hợp lệ.')
  const book = books().find(b=>b.id===id)
  if (!book) throw new Error('Không tìm thấy sách.')
  return book
}
function chapterEntry(book, chapterId) {
  if (typeof chapterId !== 'string' || !/^ch-\d{5}$/.test(chapterId)) throw new Error('Mã chương không hợp lệ.')
  const entry = book.chapters.find(ch=>ch.id===chapterId)
  if (!entry) throw new Error('Không tìm thấy chương.')
  return entry
}
function chapterPath(bookId, chapterId) {
  return path.join(libraryRoot, 'books', bookId, chapterId+'.txt')
}
function progressStore() {
  const json = readJson(positionFile(), {})
  return json && typeof json === 'object' && !Array.isArray(json) ? json : {}
}
function getProgress(bookId, chapterId) {
  return normalizeProgress(progressStore()[bookId]?.[chapterId])
}
function saveProgress(bookId, chapterId, data) {
  const book = findBook(bookId)
  chapterEntry(book, chapterId)
  const all = progressStore()
  const current = all[bookId] && typeof all[bookId]==='object' ? all[bookId] : {}
  current[chapterId] = normalizeProgress(data)
  all[bookId]=current
  atomicJson(positionFile(),all)
  return current[chapterId]
}
function importTxtFiles(_event, requestedTitle) {
  return dialog.showOpenDialog(readerWindow,{
    title:'Chọn riêng các chương TXT mà bạn muốn đọc',
    properties:['openFile','multiSelections'],
    filters:[{name:'Tệp chương TXT',extensions:['txt']}],
  }).then(result=>{
    if (result.canceled || result.filePaths.length===0) return null
    const list=prepareChapterFiles(result.filePaths)
    let totalBytes=0
    const chapters=list.map((ch,index)=>{
      const stat=fs.lstatSync(ch.source)
      if (!stat.isFile() || stat.size>MAX_CHAPTER_BYTES) throw new Error('Tệp không hợp lệ hoặc quá 4 MB.')
      totalBytes += stat.size
      if (totalBytes>MAX_IMPORT_BYTES) throw new Error('Bộ chương vượt giới hạn 160 MB.')
      return { id:'ch-'+String(index+1).padStart(5,'0'), number:ch.number,
        title:ch.title, content:safePlainText(fs.readFileSync(ch.source)) }
    })
    const id=randomUUID()
    const folder=path.join(libraryRoot,'books',id)
    const tmpFolder=path.join(libraryRoot,'books','.tmp-'+id)
    fs.mkdirSync(tmpFolder,{recursive:false})
    try {
      for(const chapter of chapters){
        fs.writeFileSync(path.join(tmpFolder,chapter.id+'.txt'),chapter.content,{encoding:'utf8',flag:'wx'})
      }
      fs.renameSync(tmpFolder,folder)
      const book={id,title:bookTitle(requestedTitle),createdAt:new Date().toISOString(),
        chapters:chapters.map(({id,number,title})=>({id,number,title}))}
      const current=books()
      if(current.length>=500)throw new Error('Thư viện đã đạt giới hạn 500 đầu sách.')
      atomicJson(libraryFile(),[...current,book])
      return book
    } catch(error) {
      fs.rmSync(tmpFolder,{recursive:true,force:true})
      fs.rmSync(folder,{recursive:true,force:true})
      throw error
    }
  })
}
function createWindow() {
  readerWindow=new BrowserWindow({
    width:1220,height:820,minWidth:720,minHeight:510,
    show:false,title:'SSR Reader — Đọc truyện',
    backgroundColor:'#f6f3ec',
    webPreferences:{
      preload:path.join(__dirname,'preload.cjs'),
      contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,
      webviewTag:false,
    },
  })
  readerWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}))
  readerWindow.webContents.on('will-navigate',(event)=>event.preventDefault())
  readerWindow.loadFile(path.join(__dirname,'index.html'))
  readerWindow.once('ready-to-show',()=>readerWindow.show())
}
app.whenReady().then(()=>{
  // Never read Writer's appData/.vela, project path, database, model settings or IPC.
  libraryRoot=path.join(app.getPath('userData'),'reader-library')
  fs.mkdirSync(path.join(libraryRoot,'books'),{recursive:true})
  ipcMain.handle('reader:books',()=>books())
  ipcMain.handle('reader:import',importTxtFiles)
  ipcMain.handle('reader:chapter',(_event,id,chId)=>{
    const book=findBook(id)
    chapterEntry(book,chId)
    const data=fs.readFileSync(chapterPath(id,chId))
    return {text:safePlainText(data),reading:getProgress(id,chId)}
  })
  ipcMain.handle('reader:progress',(_event,id,chId,data)=>saveProgress(id,chId,data))
  ipcMain.handle('reader:remove-book',(_event,id)=>{
    findBook(id)
    const keep=books().filter(b=>b.id!==id)
    atomicJson(libraryFile(),keep)
    const all=progressStore()
    delete all[id]
    atomicJson(positionFile(),all)
    fs.rmSync(path.join(libraryRoot,'books',id),{recursive:true,force:true})
    return true
  })
  createWindow()
})
app.on('window-all-closed',()=>app.quit())
