import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
const root = process.cwd()
const src = path.join(root, 'src')
const scan = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(x =>
  x.isDirectory() ? scan(path.join(dir,x.name)) :
  /\.(ts|tsx)$/.test(x.name) && !/\.test\.|__tests__/.test(x.name) ? [path.join(dir,x.name)] : [])
const files = scan(src)
function parse(filename) {
 return ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,filename.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
}
const dictionaries = files.filter(f=>f.replaceAll('\\','/').includes('/i18n/vi-'))
const dict = new Set()
for(const f of dictionaries) {
 const ast=parse(f)
 function walk(n) {
  if(ts.isPropertyAssignment(n)&&(ts.isStringLiteral(n.name)||ts.isNoSubstitutionTemplateLiteral(n.name)))dict.add(n.name.text)
  ts.forEachChild(n,walk)
 }
 walk(ast)
}
let simple=0,dynamic=0
const missing=new Map()
for(const f of files.filter(f=>f.endsWith('.tsx'))) {
 const ast=parse(f)
 function walk(n) {
  if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='text'&&n.arguments.length===2){
   const en=n.arguments[1]
   if(ts.isStringLiteral(en)||ts.isNoSubstitutionTemplateLiteral(en)){
    simple++
    if(!dict.has(en.text)){
     const arr=missing.get(en.text)||[];arr.push(path.relative(root,f));missing.set(en.text,arr)
    }
   }else dynamic++
  }
  ts.forEachChild(n,walk)
 }
 walk(ast)
}
const list=[...missing].map(([key,paths])=>({text:key,count:paths.length,paths:[...new Set(paths)]})).sort((a,b)=>b.count-a.count||a.text.localeCompare(b.text))
const report={files:files.length,dictionaries:dictionaries.length,mapped_keys:dict.size,literal_calls:simple,dynamic_calls:dynamic,missing_unique:list.length,missing_occurrences:list.reduce((n,v)=>n+v.count,0),missing:list}
const dest=process.argv.includes('--json')?path.join(root,'docs','VI_UI_MISSING_AST.json'):null
if(dest){fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');console.log('REPORT='+dest)}
console.log(JSON.stringify({...report,missing:list.slice(0,25)},null,2))
