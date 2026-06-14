import { readFileSync } from 'node:fs';
const map = JSON.parse(readFileSync('scripts/skin-global-manual-map.json','utf8')).mappings as Record<string,number>;
const products = JSON.parse(readFileSync('data/products.json','utf8')).products as {id:number;name:string;specification?:string}[];
const byId = new Map(products.map(p=>[p.id,p]));
const compact = (s:string)=>String(s).toUpperCase().replace(/\s+/g,'');
// size/gauge/qty tokens from a name
function sizes(s:string):string[]{
  const out:string[]=[]; const re=/(\d+(?:[.,]\d+)?)\s*(ML|L|MG|KG|G|IU|CC|MM|G|PCS|UNITS?|U|V|VIAL|AMP)\b/gi; let m;
  while((m=re.exec(s))){ out.push((m[1].replace(',','.')+m[2]).toUpperCase()); }
  return out;
}
let flagged=0, clean=0, noSize=0;
const rows:string[]=[];
for(const [name,id] of Object.entries(map)){
  if(id<=0) continue;
  const p=byId.get(id);
  if(!p){ rows.push(`MISSING #${id}  ⟵  ${name}`); flagged++; continue; }
  const specC=compact(p.specification||'')+ '|' + compact(p.name);
  const sz=sizes(name);
  if(sz.length===0){ noSize++; continue; }
  const miss=sz.filter(t=>!specC.includes(compact(t)));
  // a size token "8MM"/"500G" etc not in spec → suspicious
  if(miss.length===sz.length){ // none of the xlsx sizes appear in spec
    rows.push(`⚠ #${id} ${p.name} [${p.specification||''}]  ⟵  ${name}   (xlsx sizes ${sz.join(',')} not in spec)`);
    flagged++;
  } else clean++;
}
console.log(`mapped(stock): ${flagged+clean+noSize} | clean:${clean} noSizeToken:${noSize} FLAGGED:${flagged}`);
console.log('\n=== FLAGGED (verify these) ===');
rows.forEach(r=>console.log(r));
