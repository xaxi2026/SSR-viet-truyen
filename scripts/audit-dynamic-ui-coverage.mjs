import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { localizeVietnameseDynamicUi } from '../src/i18n/vi-ui-patterns.ts'
import { localizeVietnameseDynamicUiExtra } from '../src/i18n/vi-ui-patterns-extra.ts'
const root=process.cwd()
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):x.name.endsWith('.tsx')?[path.join(dir,x.name)]:[])
let sampleCount=0,matched=0,notTemplate=0
const missing=[]
for (const file of walk(path.join(root,'src'))) {
 const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 function visit(node) {
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='text'&&node.arguments.length===2){
   const arg=node.arguments[1]
   if(ts.isTemplateExpression(arg)){
    sampleCount++
    let sample=arg.head.text
    for(const span of arg.templateSpans) sample+='42'+span.literal.text
    if(localizeVietnameseDynamicUi(sample)!==undefined || localizeVietnameseDynamicUiExtra(sample)!==undefined)matched++
    else missing.push({file:path.relative(root,file),line:sf.getLineAndCharacterOfPosition(arg.getStart(sf)).line+1,sample:sample.slice(0,300)})
   }else if(!ts.isStringLiteral(arg)&&!ts.isNoSubstitutionTemplateLiteral(arg))notTemplate++
  }
  ts.forEachChild(node,visit)
 }
 visit(sf)
}
console.log(JSON.stringify({templateCalls:sampleCount,coveredBySafePatterns:matched,uncoveredTemplates:sampleCount-matched,dynamicNonTemplates:notTemplate,missing:missing.slice(0,150)},null,2))
