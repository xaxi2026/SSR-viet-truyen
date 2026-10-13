'use strict'
const { contextBridge, ipcRenderer } = require('electron')
/** Narrow, fixed IPC. Never accept file paths, code, SQL or URLs from renderer. */
contextBridge.exposeInMainWorld('readerAPI',Object.freeze({
  books:()=>ipcRenderer.invoke('reader:books'),
  importTxt:(title)=>ipcRenderer.invoke('reader:import',title),
  chapter:(bookId,chapterId)=>ipcRenderer.invoke('reader:chapter',bookId,chapterId),
  saveReading:(bookId,chapterId,reading)=>ipcRenderer.invoke('reader:progress',bookId,chapterId,reading),
  lastChapter:(bookId)=>ipcRenderer.invoke('reader:last-chapter',bookId),
  removeBook:(bookId)=>ipcRenderer.invoke('reader:remove-book',bookId),
}))
