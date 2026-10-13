'use strict'
/** Offline Windows reader. Renderer only sees author-selected TXT copies via narrow IPC. */
const api = window.readerAPI
const $ = id => document.getElementById(id)
const WIDTHS = { narrow: '590px', regular:'770px', wide:'1000px' }
const PANELS = { contents:'Mục lục', search:'Tìm trong chương', bookmarks:'Đánh dấu trong chương', settings:'Tùy chỉnh đọc truyện' }
const state = {
  books:[],book:null,chapter:null,chapterText:'',reading:{position:0,bookmarks:[]},
  fontSize:20,lineHeight:2,width:'regular',theme:'night',
  panel:'contents',focus:false,marks:[],matchIndex:0,timer:null,restoring:false
}
function status(message){ $('status').textContent=message }
function fail(error){
  const message=error?.message || String(error)
  status('Lỗi: '+message)
  window.alert(message)
}
function storageGet(key) {
  try{return localStorage.getItem(key)}catch{return null}
}
function storageSet(key,value){
  try{localStorage.setItem(key,value)}catch{/* optional preferences */}
}
function loadPrefs(){
  try {
    const prefs=JSON.parse(storageGet('ssr-reader-windows-prefs')||'{}')
    if(typeof prefs.fontSize==='number'&&Number.isFinite(prefs.fontSize))
      state.fontSize=Math.max(14,Math.min(34,Math.round(prefs.fontSize/2)*2))
    if(typeof prefs.lineHeight==='number'&&Number.isFinite(prefs.lineHeight))
      state.lineHeight=Math.max(1.4,Math.min(2.4,Math.round(prefs.lineHeight*10)/10))
    if(Object.hasOwn(WIDTHS,prefs.width))state.width=prefs.width
    if(['paper','sepia','night'].includes(prefs.theme))state.theme=prefs.theme
  } catch {/* invalid preferences reset to safe defaults */}
  applyPrefs()
}
function applyPrefs(){
  document.body.dataset.theme=state.theme
  document.body.style.setProperty('--reader-font',state.fontSize+'px')
  document.body.style.setProperty('--reader-line',String(state.lineHeight))
  document.body.style.setProperty('--reader-width',WIDTHS[state.width])
  $('fontLabel').textContent=state.fontSize+'px'
  $('lineHeightLabel').textContent=state.lineHeight.toFixed(1)
  $('fontRange').value=String(state.fontSize)
  $('lineHeightRange').value=String(state.lineHeight)
  $('themeSelect').value=state.theme
  $('widthSelect').value=state.width
  storageSet('ssr-reader-windows-prefs',JSON.stringify({
    theme:state.theme,fontSize:state.fontSize,lineHeight:state.lineHeight,width:state.width
  }))
}
function showPanel(next) {
  state.panel=state.panel===next?null:next
  const visible=state.panel
  $('readerPanel').hidden=!visible
  $('panelTitle').textContent=visible ? PANELS[visible] : ''
  $('readerPanel').dataset.panel=visible||''
  for(const type of Object.keys(PANELS)){
    $(type+'Panel').hidden=visible!==type
    const tab=document.querySelector('[data-panel="'+type+'"]')
    tab.classList.toggle('active',visible===type)
    tab.setAttribute('aria-pressed',String(visible===type))
  }
}
function setPanel(target){if(state.panel===target)return;showPanel(target)}
function toggleFocus(){
  state.focus=!state.focus
  document.body.classList.toggle('focus-mode',state.focus)
  $('focusBtn').textContent=state.focus?'▣':'⛶'
  $('focusBtn').title=state.focus?'Thoát chế độ tập trung':'Chế độ tập trung'
  if(state.focus && state.panel)showPanel(state.panel)
}
function btn(label,handler,selected=false){
  const el=document.createElement('button')
  el.type='button';el.textContent=label
  if(selected)el.classList.add('active')
  el.addEventListener('click',handler)
  return el
}
function renderBooks(){
  const list=$('bookList')
  list.replaceChildren()
  $('bookCount').textContent=String(state.books.length)
  if(!state.books.length){
    const empty=document.createElement('p')
    empty.className='panel-meta'
    empty.textContent='Chưa có tác phẩm. Nhập các chương TXT để bắt đầu.'
    list.append(empty)
  }
  for(const book of state.books){
    const item=btn(book.title,()=>openBook(book.id),state.book?.id===book.id)
    const meta=document.createElement('span')
    meta.className='sub'
    meta.textContent=book.chapters.length+' chương · Đọc offline'
    item.append(meta)
    list.append(item)
  }
}
function renderChapters(){
  const list=$('chapterList')
  list.replaceChildren()
  const chapters=state.book?.chapters||[]
  const filter=$('tocSearch').value.trim().toLocaleLowerCase('vi')
  $('chapterCount').textContent=String(chapters.length)
  for(const chapter of chapters){
    const label='Chương '+chapter.number+(chapter.title?' · '+chapter.title:'')
    if(filter&&!label.toLocaleLowerCase('vi').includes(filter))continue
    const selected=state.chapter?.id===chapter.id
    const el=btn(label,()=>openChapter(chapter.id),selected)
    if(selected){
      el.setAttribute('aria-current','page')
      const meta=document.createElement('span')
      meta.className='sub';meta.textContent='Đang đọc · '+Math.round(scrollFraction()*100)+'%'
      el.append(meta)
    }
    list.append(el)
  }
}
async function refresh(){
  state.books=await api.books()
  renderBooks()
  if(!state.book && state.books.length){
    const last=storageGet('ssr-reader-last-book')
    const chosen=state.books.some(b=>b.id===last)?last:state.books[0].id
    await openBook(chosen)
  }
}
async function openBook(id){
  await persistReading()
  state.book=state.books.find(book=>book.id===id)||null
  state.chapter=null;state.chapterText='';state.reading={position:0,bookmarks:[]}
  storageSet('ssr-reader-last-book',state.book?.id||'')
  renderBooks();renderChapters()
  $('removeBookBtn').disabled=!state.book
  $('bookmarkBtn').disabled=true;$('addBookmarkBtn').disabled=true
  if(state.book?.chapters.length){
    const last=await api.lastChapter(state.book.id)
    await openChapter(last||state.book.chapters[0].id)
  }
}
function scrollFraction(){
  const el=$('chapterSurface')
  const range=el.scrollHeight-el.clientHeight
  return range>0?Math.max(0,Math.min(1,el.scrollTop/range)):0
}
function updatePosition(percent){
  const value=Math.max(0,Math.min(100,Math.round(percent)))
  $('position').textContent=value+'%'
  $('progressFill').style.width=value+'%'
}
async function persistReading(){
  if(!state.book||!state.chapter||state.restoring)return
  clearTimeout(state.timer);state.timer=null
  state.reading.position=scrollFraction()
  try{await api.saveReading(state.book.id,state.chapter.id,state.reading)}
  catch(error){status('Không thể lưu tiến độ: '+(error?.message||String(error)))}
}
function scheduleSave(){
  if(!state.chapter||state.restoring)return
  updatePosition(scrollFraction()*100)
  clearTimeout(state.timer)
  state.timer=setTimeout(()=>void persistReading(),600)
}
function refreshBookmarks(){
  const bookmarks=state.reading.bookmarks||[]
  const options=$('bookmarkJump')
  options.replaceChildren(new Option('Chọn vị trí đã đánh dấu',''))
  const list=$('bookmarkList')
  list.replaceChildren()
  $('bookmarkBadge').textContent=String(bookmarks.length)
  for(const fraction of bookmarks){
    const percent=Math.round(fraction*100)
    options.add(new Option('Vị trí '+percent+'%',String(fraction)))
    const row=document.createElement('div')
    row.className='bookmark-row'
    const link=btn('☆ Vị trí '+percent+'%',()=>{jumpTo(fraction);setPanel(null)})
    const remove=btn('×',async()=>{
      state.reading.bookmarks=state.reading.bookmarks.filter(x=>x!==fraction)
      await persistReading();refreshBookmarks()
    })
    remove.title='Xóa dấu trang này';remove.setAttribute('aria-label','Xóa dấu trang '+percent+'%')
    row.append(link,remove);list.append(row)
  }
  options.disabled=!state.chapter||bookmarks.length===0
}
function jumpTo(fraction){
  const el=$('chapterSurface')
  el.scrollTop=Math.max(0,Math.min(1,fraction))*Math.max(0,el.scrollHeight-el.clientHeight)
  scheduleSave()
}
function paragraphs(){
  const parts=state.chapterText.split(/\n\s*\n/u).filter(p=>p.trim())
  if(parts.length>1 && state.chapter){
    const heading=parts[0].trim()
    const number=String(state.chapter.number)
    if(new RegExp('^(?:chương|chapter)\\s*0*'+number+'(?:\\s*[-:.·_]\\s*.*)?$','iu').test(heading)
      ||new RegExp('^第\\s*0*'+number+'\\s*章(?:\\s*.*)?$','u').test(heading)) parts.shift()
  }
  return parts
}
function renderMatches(){
  const list=$('matchList')
  list.replaceChildren()
  for(let index=0;index<state.marks.length && index<70;index++){
    const mark=state.marks[index]
    const excerpt=mark.closest('p')?.textContent?.trim().slice(0,100)||'Kết quả'
    const row=btn((index+1)+'. '+excerpt,()=>gotoMark(index))
    list.append(row)
  }
}
function renderText(){
  const article=$('chapterText')
  article.replaceChildren()
  state.marks=[];state.matchIndex=0
  if(!state.chapter){$('matchCount').textContent='Nhập từ khóa để tìm đoạn văn.';return}
  const heading=document.createElement('h2')
  heading.textContent='Chương '+state.chapter.number+(state.chapter.title?' · '+state.chapter.title:'')
  article.append(heading)
  const query=$('chapterSearch').value.trim().slice(0,70)
  const needle=query.toLocaleLowerCase('vi')
  const parts=paragraphs()
  for(let paragraphNo=0;paragraphNo<parts.length;paragraphNo++){
    const source=parts[paragraphNo]
    const paragraph=document.createElement('p')
    paragraph.dataset.paragraph=String(paragraphNo)
    if(!needle){paragraph.textContent=source}
    else {
      const lower=source.toLocaleLowerCase('vi')
      let offset=0,count=0
      while(offset<source.length && count<100 && state.marks.length<400){
        const index=lower.indexOf(needle,offset)
        if(index<0)break
        if(index>offset)paragraph.append(document.createTextNode(source.slice(offset,index)))
        const mark=document.createElement('mark')
        mark.textContent=source.slice(index,index+query.length)
        paragraph.append(mark)
        state.marks.push(mark)
        offset=index+query.length;count++
      }
      paragraph.append(document.createTextNode(source.slice(offset)))
    }
    article.append(paragraph)
  }
  $('matchCount').textContent=query
    ? state.marks.length+' kết quả trong chương'
    : 'Nhập từ khóa để tìm đoạn văn.'
  renderMatches()
}
function gotoMark(index){
  if(!state.marks.length)return
  for(const mark of state.marks)mark.classList.remove('focus')
  const current=state.marks[index%state.marks.length]
  current.classList.add('focus')
  current.scrollIntoView({block:'center',behavior:'smooth'})
  state.matchIndex=(index+1)%state.marks.length
}
function nextMatch(){gotoMark(state.matchIndex)}
function updateNavigation(){
  const chs=state.book?.chapters||[]
  const i=chs.findIndex(ch=>ch.id===state.chapter?.id)
  const isPrev=i>0, isNext=i>=0&&i<chs.length-1
  $('prevBtn').disabled=!isPrev;$('nextBtn').disabled=!isNext
  $('bottomPrevBtn').disabled=!isPrev;$('bottomNextBtn').disabled=!isNext
  $('chapterEnd').hidden=i<0
}
async function openChapter(chapterId){
  if(!state.book)return
  await persistReading()
  const chapter=state.book.chapters.find(ch=>ch.id===chapterId)
  if(!chapter)return
  const bookId=state.book.id
  try{
    const result=await api.chapter(bookId,chapterId)
    if(state.book?.id!==bookId)return
    state.chapter=chapter;state.chapterText=result.text
    state.reading=result.reading
    // Persist last opened chapter even before scrolling.
    await api.saveReading(bookId,chapterId,state.reading)
    $('readerTitle').textContent=state.book.title+' · Chương '+chapter.number
    $('chapterSearch').value=''
    renderText();renderChapters();refreshBookmarks();updateNavigation()
    $('bookmarkBtn').disabled=false;$('addBookmarkBtn').disabled=false
    state.restoring=true
    requestAnimationFrame(()=>{
      const el=$('chapterSurface')
      el.scrollTop=state.reading.position*Math.max(0,el.scrollHeight-el.clientHeight)
      updatePosition(state.reading.position*100)
      state.restoring=false
    })
    status('Đang đọc · Chương '+chapter.number+' / '+state.book.chapters.length+' · Offline')
  }catch(error){fail(error)}
}
function move(delta){
  if(!state.book||!state.chapter)return
  const chapters=state.book.chapters
  const pos=chapters.findIndex(ch=>ch.id===state.chapter.id)
  const target=chapters[pos+delta]
  if(target)void openChapter(target.id)
}
async function bookmark(){
  if(!state.chapter)return
  const fraction=Number(scrollFraction().toFixed(4))
  if(!state.reading.bookmarks.some(x=>Math.abs(x-fraction)<.005)){
    state.reading.bookmarks=[...state.reading.bookmarks,fraction].slice(-50).sort((a,b)=>a-b)
  }
  await persistReading()
  refreshBookmarks()
  setPanel('bookmarks')
  status('Đã đánh dấu tại '+Math.round(fraction*100)+'% chương này')
}
async function removeBook(){
  if(!state.book)return
  if(!confirm('Xóa bản sao sách “'+state.book.title+'” khỏi tủ sách? Tệp TXT gốc không bị thay đổi.'))return
  await persistReading()
  await api.removeBook(state.book.id)
  state.book=null;state.chapter=null;state.chapterText='';state.reading={position:0,bookmarks:[]}
  storageSet('ssr-reader-last-book','')
  $('chapterText').replaceChildren()
  $('readerTitle').textContent='◩ Đọc truyện'
  $('bookmarkBtn').disabled=true;$('addBookmarkBtn').disabled=true
  $('removeBookBtn').disabled=true
  $('chapterEnd').hidden=true
  updatePosition(0)
  refreshBookmarks();renderChapters();updateNavigation()
  await refresh()
}
async function importBook(){
  const trigger=$('importBtn')
  trigger.disabled=true
  status('Chọn các tệp TXT bạn muốn đọc…')
  try{
    const result=await api.importTxt($('bookName').value)
    if(!result){status('Đã hủy nhập sách');return}
    $('bookName').value=''
    state.books=await api.books()
    await openBook(result.id)
    setPanel('contents')
    status('Đã nhập '+result.chapters.length+' chương vào SSR Reader')
  }catch(error){fail(error)}
  finally{trigger.disabled=false}
}
function bind(){
  $('importBtn').addEventListener('click',()=>void importBook())
  $('tocSearch').addEventListener('input',renderChapters)
  $('chapterSearch').addEventListener('input',()=>{const fraction=scrollFraction();renderText();requestAnimationFrame(()=>jumpTo(fraction))})
  $('nextMatchBtn').addEventListener('click',nextMatch)
  $('prevBtn').addEventListener('click',()=>move(-1))
  $('nextBtn').addEventListener('click',()=>move(1))
  $('bottomPrevBtn').addEventListener('click',()=>move(-1))
  $('bottomNextBtn').addEventListener('click',()=>move(1))
  $('bookmarkBtn').addEventListener('click',()=>void bookmark())
  $('addBookmarkBtn').addEventListener('click',()=>void bookmark())
  $('bookmarkJump').addEventListener('change',event=>{if(event.target.value)jumpTo(Number(event.target.value))})
  $('removeBookBtn').addEventListener('click',()=>void removeBook().catch(fail))
  $('fontMinusBtn').addEventListener('click',()=>{state.fontSize=Math.max(14,state.fontSize-2);applyPrefs()})
  $('fontPlusBtn').addEventListener('click',()=>{state.fontSize=Math.min(34,state.fontSize+2);applyPrefs()})
  $('fontRange').addEventListener('input',event=>{state.fontSize=Number(event.target.value);applyPrefs()})
  $('lineHeightRange').addEventListener('input',event=>{state.lineHeight=Number(event.target.value);applyPrefs()})
  $('themeSelect').addEventListener('change',event=>{state.theme=event.target.value;applyPrefs()})
  $('widthSelect').addEventListener('change',event=>{state.width=event.target.value;applyPrefs()})
  $('closePanelBtn').addEventListener('click',()=>{if(state.panel)showPanel(state.panel)})
  for(const button of document.querySelectorAll('.tool-tab')){
    button.addEventListener('click',()=>showPanel(button.dataset.panel))
  }
  $('focusBtn').addEventListener('click',toggleFocus)
  $('chapterSurface').addEventListener('scroll',scheduleSave,{passive:true})
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void persistReading()})
  window.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      if(state.focus)toggleFocus()
      else if(state.panel)showPanel(state.panel)
      return
    }
    if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable]'))return
    if(event.altKey&&event.key==='ArrowLeft'){event.preventDefault();move(-1)}
    if(event.altKey&&event.key==='ArrowRight'){event.preventDefault();move(1)}
  })
}
bind()
loadPrefs()
refresh().catch(fail)
