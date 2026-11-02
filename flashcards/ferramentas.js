/* Ferramentas da fonte: coordenadas relativas à imagem; nenhum pedido de rede. */
window.criarFerramentasFonte = ({deck, avisar, salvar}) => {
 const pane=document.getElementById('fonte');
 const pageKey=f=>JSON.stringify([f.documento,f.tipo,f.pagina]);
 const validKeys=new Set(deck.fontes.map(pageKey));
 const types=['lapis','verde','azul'];
 const MAX_POINTS=100000, MAX_PAGE=25000, MAX_BYTES=2500000;
 let drawings={}, tool='seta', active=null, ray=null, penUntil=0, frame=0;
 const views=new Map(), history=new Map();
 const cursor=document.createElement('span');cursor.className='pencil-cursor';cursor.textContent='✎';cursor.setAttribute('aria-hidden','true');cursor.hidden=true;pane.parentElement.append(cursor);
 function cursorAt(e){cursor.hidden=tool!=='lapis';cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px';}
 pane.addEventListener('pointerleave',()=>{cursor.hidden=true;});
 function validate(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Traços inválidos.');
  const result={};let total=0;
  for(const [key,strokes] of Object.entries(value)){
   if(!validKeys.has(key)||!Array.isArray(strokes)||strokes.length>1500)throw Error('Página ou quantidade de traços inválida.');
   let count=0;result[key]=strokes.map(s=>{
    if(!s||!types.includes(s.tipo)||!Array.isArray(s.pontos)||!s.pontos.length)throw Error('Traço inválido.');
    count+=s.pontos.length;total+=s.pontos.length;
    if(count>MAX_PAGE||total>MAX_POINTS)throw Error('Limite de pontos dos traços excedido.');
    return {tipo:s.tipo,pontos:s.pontos.map(p=>{if(!Array.isArray(p)||p.length!==2||!p.every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw Error('Coordenada de traço inválida.');return [...p];})};
   });
  }
  if(JSON.stringify(result).length>MAX_BYTES)throw Error('Limite de armazenamento dos traços excedido.');
  return result;
 }
 function snapshot(key){const h=history.get(key)||[];h.push(structuredClone(drawings[key]||[]));if(h.length>12)h.shift();history.set(key,h);}
 function drawPath(ctx,s,w,h){
  if(!s.pontos.length)return;
  ctx.beginPath();ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle={lapis:'#4f5066',verde:'#39ff14',azul:'#55cfff',raio:'#bc31ff'}[s.tipo];
  ctx.globalAlpha=['verde','azul'].includes(s.tipo)?.32:1;
  ctx.lineWidth=({lapis:.003,verde:.026,azul:.026,raio:.006}[s.tipo])*w;
  const a=s.pontos[0];ctx.moveTo(a[0]*w,a[1]*h);
  for(const p of s.pontos.slice(1))ctx.lineTo(p[0]*w,p[1]*h);
  if(s.pontos.length===1)ctx.lineTo(a[0]*w+.01,a[1]*h);
  if(s.tipo==='raio'){ctx.shadowColor='#ce3eff';ctx.shadowBlur=8;}
  ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;
 }
 function render(v){
  if(!v.visible||!v.stage.isConnected)return;
  const r=v.stage.getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,2,4096/Math.max(r.width,r.height),Math.sqrt(8000000/(r.width*r.height))),w=Math.round(r.width*scale),h=Math.round(r.height*scale);
  if(!w||!h)return;
  if(v.canvas.width!==w||v.canvas.height!==h){v.canvas.width=w;v.canvas.height=h;}
  const ctx=v.canvas.getContext('2d');ctx.clearRect(0,0,w,h);
  for(const s of drawings[v.key]||[])drawPath(ctx,s,w,h);
  if(active?.key===v.key&&types.includes(active.stroke.tipo))drawPath(ctx,active.stroke,w,h);
  if(ray?.key===v.key)drawPath(ctx,ray.stroke,w,h);
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;for(const v of views.values())render(v);});}
 const observer=new IntersectionObserver(entries=>{for(const e of entries){const v=views.get(e.target);if(!v)continue;v.visible=e.isIntersecting;if(!v.visible){v.canvas.width=0;v.canvas.height=0;}else schedule();}},{root:pane});
 const resize=new ResizeObserver(entries=>{for(const e of entries){const v=views.get(e.target);if(v?.visible)schedule();if(v)alignText(v);}});
 const measure=document.createElement('canvas').getContext('2d'); // mesure seulement, jamais un second canvas de dessin
 function alignText(v){
  const height=v.stage.clientHeight;
  for(const el of v.stage.querySelectorAll('.pdf-line')){
   const l=el._line;const size=l.tamanho*height;
   el.style.fontSize=size+'px';el.style.lineHeight=l.h*height+'px';if(l.caracteres?.length){el.style.transform='none';for(const child of el.children){const c=child._char;child.style.left=(c.x-l.x)*v.stage.clientWidth+'px';child.style.top=(c.y-l.y)*height+'px';child.style.width=Math.max(c.w*v.stage.clientWidth,1)+'px';child.style.height=c.h*height+'px';child.style.lineHeight=c.h*height+'px';}continue;}measure.font=el.style.fontStyle+' '+el.style.fontWeight+' '+size+'px '+el.style.fontFamily;
   const width=measure.measureText(l.texto).width;
   el.style.transform='scaleX('+(width?l.w*v.stage.clientWidth/width:1)+')';
  }
 }
 function point(e,stage){const r=stage.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))].map(n=>Math.round(n*100000)/100000);}
 function distance(p,a,b,w,h){const x=p[0]*w,y=p[1]*h,ax=a[0]*w,ay=a[1]*h,dx=(b[0]-a[0])*w,dy=(b[1]-a[1])*h;const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-ax-t*dx,y-ay-t*dy);}
 function crosses(a,b,c,d){const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
 function erase(a,p){
  const r=a.view.stage.getBoundingClientRect();
  const previous=a.eraseLast||p;
  drawings[a.key]=(drawings[a.key]||[]).filter(s=>!s.pontos.some((q,i)=>{const b=s.pontos[Math.max(0,i-1)],radius=10+(s.tipo==='lapis'?1.5:r.width*.013);return crosses(previous,p,q,b)||Math.min(distance(p,q,b,r.width,r.height),distance(previous,q,b,r.width,r.height),distance(q,previous,p,r.width,r.height),distance(b,previous,p,r.width,r.height))<radius;}));
  a.eraseLast=p;
 }
 function finish(){
  if(!active)return;
  const a=active;active=null;if(a.pointerType==='pen')penUntil=performance.now()+1200;
  if(a.stroke.tipo==='raio'){
   const old=ray;setTimeout(()=>{if(ray===old){ray=null;schedule();}},180);
  }else {
   // Perder captura/foco encerra e guarda o que já foi escrito; não apaga o gesto.
   if(types.includes(a.stroke.tipo)){
    const count=Object.values(drawings).flat().reduce((n,s)=>n+s.pontos.length,0)+a.stroke.pontos.length;
    const local=(drawings[a.key]||[]).reduce((n,s)=>n+s.pontos.length,0)+a.stroke.pontos.length;
    if((drawings[a.key]||[]).length>=1500||count>MAX_POINTS||local>MAX_PAGE||JSON.stringify(drawings).length+JSON.stringify(a.stroke).length>MAX_BYTES){avisar('Limite dos traços atingido. Copie o progresso e apague alguns traços. Este último traço não foi guardado.');history.get(a.key)?.pop();}
    else (drawings[a.key]??=[]).push(a.stroke);
   }
   salvar();
  }
  try{a.view.stage.releasePointerCapture(a.id);}catch{}
  schedule();updateUndo();
 }
 function addPoint(e){if(!active)return;const a=active,p=point(e,a.view.stage);
  if(a.stroke.tipo==='borracha'){erase(a,p);schedule();return;}
  const prev=a.stroke.pontos.at(-1),r=a.view.stage.getBoundingClientRect();
  if(Math.hypot((p[0]-prev[0])*r.width,(p[1]-prev[1])*r.height)<.6)return;
  if(a.stroke.pontos.length>=MAX_PAGE){finish();avisar('Traço muito longo: solte e comece outro.');return;}
  a.stroke.pontos.push(p);schedule();
 }
 function mount(stage,page){
  const key=pageKey(page),canvas=document.createElement('canvas');canvas.className='ink-layer';canvas.setAttribute('aria-hidden','true');canvas.width=canvas.height=0;
  const v={key,stage,canvas,visible:false};views.set(stage,v);
  const source=(window.TEXTO_PDF||[]).find(p=>p.pagina===page.pagina&&p.documento===page.documento);
  const layer=document.createElement('div');layer.className='pdf-text';layer.lang='es';
  if(source?.linhas.length){
   for(const l of source.linhas){const span=document.createElement('span');span.className='pdf-line';if(l.caracteres?.length){for(const c of l.caracteres){const ch=document.createElement('span');ch.className='pdf-char';ch.textContent=c.texto;ch._char=c;span.append(ch);}}else span.textContent=l.texto;span._line=l;Object.assign(span.style,{left:l.x*100+'%',top:l.y*100+'%',height:l.h*100+'%',fontFamily:JSON.stringify(l.familia)+', Arial, sans-serif',fontWeight:l.negrito?'700':'400',fontStyle:l.italico?'italic':'normal'});layer.append(span);}
  }else {stage.title='Página '+page.pagina+': imagem sem texto selecionável no PDF.';}
  stage.append(layer,canvas);resize.observe(stage);observer.observe(stage);
  stage.addEventListener('pointerdown',e=>{
   if(tool==='seta')return;
   e.stopPropagation();
   if(e.pointerType==='pen'){penUntil=performance.now()+1200;if(active?.pointerType==='touch')finish();}
   if(active||e.button!==0||!e.isPrimary||(e.pointerType==='touch'&&(performance.now()<penUntil||e.width>35||e.height>35)))return;
   e.preventDefault();window.getSelection()?.removeAllRanges();
   const stroke={tipo:tool,pontos:[point(e,stage)]};
   active={id:e.pointerId,pointerType:e.pointerType,key,view:v,stroke};
   stage.setPointerCapture(e.pointerId);
   if(tool==='raio')ray={key,stroke};else snapshot(key);
   if(tool==='borracha')erase(active,stroke.pontos[0]);
   schedule();
  });
  stage.addEventListener('pointermove',e=>{cursorAt(e);if(active?.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();const samples=e.getCoalescedEvents?.();for(const sample of samples?.length?samples:[e])addPoint(sample);});
  stage.addEventListener('pointerup',e=>{if(active?.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();addPoint(e);finish();});
  stage.addEventListener('pointercancel',e=>{if(active?.id===e.pointerId)finish();});
  stage.addEventListener('lostpointercapture',e=>{if(active?.id===e.pointerId)finish();});
  stage.addEventListener('click',e=>e.stopPropagation());
 }
 function reset(){cursor.hidden=true;finish();observer.disconnect();resize.disconnect();for(const v of views.values()){v.canvas.width=v.canvas.height=0;}views.clear();ray=null;}
 function visibleKey(){const r=pane.getBoundingClientRect();let best=null,area=0;for(const v of views.values()){const b=v.stage.getBoundingClientRect();const overlap=Math.max(0,Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top));if(overlap>area){area=overlap;best=v.key;}}return best;}
 function updateUndo(){undo.disabled=!(history.get(visibleKey())?.length);}
 const bar=document.createElement('div');bar.className='source-tools';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Ferramentas da fonte');
 const icons={seta:'↖',raio:'ϟ',lapis:'✎',verde:'▰',azul:'▰',borracha:'▱'};
 const names={seta:'Seta: selecionar texto e rolar',raio:'Raio roxo temporário',lapis:'Lápis',verde:'Marcador verde fluorescente',azul:'Marcador azul claro',borracha:'Borracha: apagar traço inteiro'};
 for(const t of Object.keys(icons)){const b=document.createElement('button');b.type='button';b.textContent=icons[t];b.dataset.tool=t;b.title=names[t];b.setAttribute('aria-label',names[t]);b.setAttribute('aria-pressed',String(t===tool));b.onclick=()=>{finish();tool=t;cursor.hidden=true;pane.dataset.tool=t;pane.classList.toggle('drawing',t!=='seta');for(const x of bar.querySelectorAll('[data-tool]'))x.setAttribute('aria-pressed',String(x.dataset.tool===t));};bar.append(b);}
 const undo=document.createElement('button');undo.textContent='↶';undo.title='Desfazer na página mais visível';undo.setAttribute('aria-label',undo.title);undo.id='desfazer-fonte';undo.disabled=true;undo.onclick=()=>{finish();const key=visibleKey(),h=history.get(key);if(h?.length){drawings[key]=h.pop();salvar();schedule();}updateUndo();};bar.append(undo);
 const auto=document.createElement('button');auto.id='automatico';auto.textContent='▶';auto.title='Iniciar reprodução automática';auto.setAttribute('aria-label',auto.title);bar.prepend(auto);
 pane.parentElement.prepend(bar);pane.addEventListener('scroll',updateUndo,{passive:true});
 pane.addEventListener('keydown',e=>e.stopPropagation());bar.addEventListener('keydown',e=>e.stopPropagation());
 window.addEventListener('blur',()=>{cursor.hidden=true;finish();});
 window.addEventListener('pagehide',()=>finish());
 window.addEventListener('pointerup',e=>{if(active?.id===e.pointerId){addPoint(e);finish();}},true);
 return {mount,reset,validate,export:()=>drawings,load:value=>{drawings=validate(value);history.clear();schedule();updateUndo();},refresh:()=>{schedule();updateUndo();}};
};
