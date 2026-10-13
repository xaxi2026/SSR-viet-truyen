'use strict'
/** This renderer never receives Writer/project paths, SQLite, prompt or AI data. */
const api = window.readerAPI
const $ = id => document.getElementById(id)
const state = { books:[], book:null, chapter:null, chapterText:'', reading:{position:0,bookmarks:[]},
  fontSize:20, theme:'paper', marks:[], matchIndex:0, timer:null, restoring:false }
function showStatus(message){ $('status').textContent=message }
function fail(error){ showStatus('Lỗi: '+(error?.message||String(error))); window.alert(error?.message||String(error)) }
function cleanPrefs(){
  try {const x=JSON.parse(localStorage.getItem('ssr-reader-windows-prefs')||'{}')
    if(Number.isFinite(x.fontSize))state.fontSize=Math.max(14,Math.min(34,Math.round(x.fontSize)))
    if(['paper','sepia','night'].includes(x.theme))state.theme=x.theme
  } catch {/* preferences are optional */}
  applyPrefs()
}
function applyPrefs(){
  document.body.dataset.theme=state.theme
  document.body.style.setProperty('--reader-font',state.fontSize+'px')
  $('fontLabel').textContent=state.fontSize+'px'
  $('themeSelect').value=state.theme
  try{localStorage.setItem('ssr-reader-windows-prefs',JSON.stringify({theme:state.theme,fontSize:state.fontSize}))}catch{}
}
function btn(label,handler,selected=false){
  const element=document.createElement('button')
  element.type='button'
  element.textContent=label
  if(selected) element.classList.add('active')
  element.addEventListener('click',handler)
  return element
}
function renderBooks(){
  $('bookCount').textContent=String(state.books.length)
  const list=$('bookList')
  list.replaceChildren()
  for(const b of state.books){
    const button=btn(b.title,()=>openBook(b.id),state.book?.id===b.id)
    const badge=document.createElement('span')
    badge.className='sub'
    badge.textContent=b.chapters.length+' chương · lưu riêng trong SSR Reader'
    button.append(badge)
    list.append(button)
  }
}
function renderChapters(){
  const list=$('chapterList')
  list.replaceChildren()
  const chapters=state.book?.chapters||[]
  const q=$('tocSearch').value.trim().toLocaleLowerCase('vi')
  $('chapterCount').textContent=String(chapters.length)
  for(const ch of chapters){
    const title='Chương '+ch.number+' · '+ch.title
    if(q && !title.toLocaleLowerCase('vi').includes(q))continue
    list.append(btn(title,()=>openChapter(ch.id),state.chapter?.id===ch.id))
  }
}
async function refresh(){
  state.books=await api.books()
  renderBooks()
  if(!state.book && state.books.length)await openBook(state.books[0].id)
}
async function openBook(id){
  await persistReading()
  state.book=state.books.find(b=>b.id===id)||null
  state.chapter=null
  state.reading={position:0,bookmarks:[]}
  renderBooks();renderChapters()
  $('removeBookBtn').disabled=!state.book
  if(state.book?.chapters.length){
    const last=await api.lastChapter(state.book.id)
    await openChapter(last || state.book.chapters[0].id)
  }
}
function scrollFraction(){
  const node=$('chapterSurface')
  return node.scrollHeight<=node.clientHeight ? 0 : Math.max(0,Math.min(1,node.scrollTop/(node.scrollHeight-node.clientHeight)))
}
async function persistReading(){
  if(!state.book||!state.chapter||state.restoring)return
  clearTimeout(state.timer)
  state.timer=null
  state.reading.position=scrollFraction()
  try{await api.saveReading(state.book.id,state.chapter.id,state.reading)}
  catch(error){showStatus('Không lưu được vị trí: '+(error?.message||String(error)))}
}
function scheduleSave(){
  if(!state.chapter||state.restoring)return
  $('position').textContent=Math.round(scrollFraction()*100)+'%'
  clearTimeout(state.timer)
  state.timer=setTimeout(()=>void persistReading(),550)
}
function refreshBookmarks(){
  const options=$('bookmarkJump')
  options.replaceChildren(new Option('Dấu trang đã lưu',''))
  for(const value of state.reading.bookmarks){
    options.add(new Option(Math.round(value*100)+'% nội dung',String(value)))
  }
  options.disabled=!state.chapter||state.reading.bookmarks.length===0
}
function jumpTo(value){
  const node=$('chapterSurface')
  node.scrollTop=Math.max(0,Math.min(1,value))*(node.scrollHeight-node.clientHeight)
  scheduleSave()
}
function renderText(){
  const article=$('chapterText')
  article.replaceChildren()
  state.marks=[]
  state.matchIndex=0
  if(!state.chapter)return
  const title=document.createElement('h2')
  title.textContent='Chương '+state.chapter.number+' · '+state.chapter.title
  article.append(title)
  const query=$('chapterSearch').value.trim().slice(0,70)
  const lower=query.toLocaleLowerCase('vi')
  const parts=state.chapterText.split(/\n\s*\n/u).filter(part=>part.trim())
  for(const paragraphText of parts){
    const paragraph=document.createElement('p')
    if(!query)paragraph.textContent=paragraphText
    else {
      let offset=0,matchCount=0
      const srcLower=paragraphText.toLocaleLowerCase('vi')
      while(offset<paragraphText.length && matchCount<150){
        const index=srcLower.indexOf(lower,offset)
        if(index===-1)break
        if(index>offset)paragraph.append(document.createTextNode(paragraphText.slice(offset,index)))
        const mark=document.createElement('mark')
        mark.textContent=paragraphText.slice(index,index+query.length)
        paragraph.append(mark)
        state.marks.push(mark)
        offset=index+query.length
        matchCount++
      }
      paragraph.append(document.createTextNode(paragraphText.slice(offset)))
    }
    article.append(paragraph)
  }
  $('matchCount').textContent=query?(state.marks.length+' kết quả'):''
}
function nextMatch(){
  if(!state.marks.length)return
  for(const mark of state.marks)mark.classList.remove('focus')
  const current=state.marks[state.matchIndex % state.marks.length]
  current.classList.add('focus')
  current.scrollIntoView({block:'center',behavior:'smooth'})
  state.matchIndex++
}
async function openChapter(chId){
  if(!state.book)return
  await persistReading()
  const ch=state.book.chapters.find(x=>x.id===chId)
  if(!ch)return
  const bookId=state.book.id
  try{
    const result=await api.chapter(bookId,chId)
    if(state.book?.id!==bookId)return
    state.chapter=ch
    state.chapterText=result.text
    state.reading=result.reading
    await api.saveReading(bookId,chId,state.reading)
    $('readerTitle').textContent=state.book.title+' · Chương '+ch.number
    $('bookmarkBtn').disabled=false
    $('chapterSearch').value=''
    renderText()
    renderChapters()
    refreshBookmarks()
    const i=state.book.chapters.findIndex(x=>x.id===chId)
    $('prevBtn').disabled=i<=0
    $('nextBtn').disabled=i<0||i>=state.book.chapters.length-1
    state.restoring=true
    requestAnimationFrame(()=>{
      const node=$('chapterSurface')
      node.scrollTop=state.reading.position*Math.max(0,node.scrollHeight-node.clientHeight)
      $('position').textContent=Math.round(state.reading.position*100)+'%'
      state.restoring=false
    })
    showStatus('Đang đọc · Chương '+ch.number+' · offline')
  }catch(e){fail(e)}
}
function move(delta){
  if(!state.book||!state.chapter)return
  const pos=state.book.chapters.findIndex(x=>x.id===state.chapter.id)
  const ch=state.book.chapters[pos+delta]
  if(ch)void openChapter(ch.id)
}
async function bookmark(){
  if(!state.chapter)return
  const fraction=Number(scrollFraction().toFixed(4))
  if(!state.reading.bookmarks.some(x=>Math.abs(x-fraction)<.005)){
    state.reading.bookmarks=[...state.reading.bookmarks,fraction].slice(-50).sort((a,b)=>a-b)
  }
  await persistReading()
  refreshBookmarks()
  showStatus('Đã lưu dấu trang ở '+Math.round(fraction*100)+'%')
}
async function removeBook(){
  if(!state.book)return
  if(!confirm('Xóa bản sao sách “'+state.book.title+'” khỏi thư viện SSR Reader? Tệp gốc của bạn vẫn được giữ nguyên.'))return
  await persistReading()
  await api.removeBook(state.book.id)
  state.book=null;state.chapter=null;state.chapterText='';state.reading={position:0,bookmarks:[]}
  $('chapterText').replaceChildren()
  $('readerTitle').textContent='Chào mừng đến với SSR Reader'
  $('bookmarkBtn').disabled=true
  $('prevBtn').disabled=true
  $('nextBtn').disabled=true
  $('removeBookBtn').disabled=true
  await refresh()
}
async function importBook(){
  const button=$('importBtn')
  button.disabled=true
  showStatus('Đang chờ bạn chọn các chương TXT…')
  try {
    const result=await api.importTxt($('bookName').value)
    if(!result){showStatus('Đã hủy nhập sách');return}
    $('bookName').value=''
    state.books=await api.books()
    await openBook(result.id)
    showStatus('Đã nhập '+result.chapters.length+' chương vào thư viện Reader riêng')
  } catch(error){fail(error)}
  finally {button.disabled=false}
}
function bind(){
  $('importBtn').addEventListener('click',()=>void importBook())
  $('tocSearch').addEventListener('input',renderChapters)
  $('prevBtn').addEventListener('click',()=>move(-1))
  $('nextBtn').addEventListener('click',()=>move(1))
  $('fontMinusBtn').addEventListener('click',()=>{state.fontSize=Math.max(14,state.fontSize-2);applyPrefs()})
  $('fontPlusBtn').addEventListener('click',()=>{state.fontSize=Math.min(34,state.fontSize+2);applyPrefs()})
  $('themeSelect').addEventListener('change',e=>{state.theme=e.target.value;applyPrefs()})
  $('chapterSearch').addEventListener('input',()=>renderText())
  $('nextMatchBtn').addEventListener('click',nextMatch)
  $('bookmarkBtn').addEventListener('click',()=>void bookmark())
  $('bookmarkJump').addEventListener('change',e=>{if(e.target.value)jumpTo(Number(e.target.value))})
  $('removeBookBtn').addEventListener('click',()=>void removeBook().catch(fail))
  $('chapterSurface').addEventListener('scroll',scheduleSave,{passive:true})
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void persistReading()})
  window.addEventListener('keydown',e=>{
    if(e.target instanceof HTMLElement && e.target.closest('input,textarea,select'))return
    if(e.altKey && e.key==='ArrowLeft'){e.preventDefault();move(-1)}
    if(e.altKey && e.key==='ArrowRight'){e.preventDefault();move(1)}
  })
}
bind();cleanPrefs();refresh().catch(fail)
