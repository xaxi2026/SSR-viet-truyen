import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
const root=process.cwd()
const src=path.join(root,'src')
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):x.name.endsWith('.tsx')?[path.join(dir,x.name)]:[])
const rows=[]
for(const f of walk(src)){
 const sf=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 function visit(n){
  if(ts.isJsxText(n)){
   const s=n.text.replace(/\s+/gu,' ').trim()
   if(s.length>2 && /[A-Za-z]{3,}/u.test(s))rows.push({path:path.relative(root,f),line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,kind:'jsx',text:s.slice(0,250)})
  }
  if(ts.isJsxAttribute(n)&&n.initializer&&ts.isStringLiteral(n.initializer)&&/^(?:placeholder|title|aria-label|alt)$/u.test(n.name.text)){
   const s=n.initializer.text.trim()
   if(s.length>2&&/[A-Za-z]{3,}/u.test(s))rows.push({path:path.relative(root,f),line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,kind:n.name.text,text:s.slice(0,250)})
  }
  ts.forEachChild(n,visit)
 }
 visit(sf)
}
console.log('STATIC JSX RAW TEXT COUNT',rows.length)
for(const x of rows.slice(0,200))console.log(x.path+':'+x.line+' ['+x.kind+'] '+x.text)
