(() => {
'use strict';
const deck=window.BARALHO, $=id=>document.getElementById(id);
if(!deck?.cartoes?.length){$('mensagem').textContent='Dados do baralho ausentes.';return;}
const ids=new Set(deck.cartoes.map(c=>c.id)), signature=deck.cartoes.map(c=>c.id).join('|'), key='flashcards-ativos-v1:'+signature;
let progress={}, prefs={pt:true,ler:'ambas',justificativa:false,pausa:1}, storageOK=true;
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.assinatura===signature){progress=validateProgress(saved.cartoes);prefs.pt=saved.preferencias?.pt!==false;const p=saved.preferencias||{};prefs.leituraV2=p.leituraV2===true;if(['nada','pergunta','resposta','ambas'].includes(p.ler))prefs.ler=p.ler;if(typeof p.justificativa==='boolean')prefs.justificativa=p.justificativa;if([0,.5,1,2,3,5].includes(p.pausa))prefs.pausa=p.pausa;}}catch{storageOK=false;}
// Migração única: uma escolha Nada feita daqui em diante é preservada.
if(!prefs.leituraV2){if(prefs.ler==='nada')prefs.ler='ambas';prefs.leituraV2=true;}
let activated=false;
let toastTimer;
const storedPrefs=(()=>{try{return JSON.parse(localStorage.getItem(key)||'null')?.preferencias||{};}catch{return {};}})();
const ink=window.criarFerramentasFonte({deck,avisar:toast,salvar:save});
try {const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.assinatura===signature&&saved.tracos)ink.load(saved.tracos);}catch{storageOK=false;setTimeout(()=>toast('Não foi possível recuperar os traços salvos. Use uma cópia do progresso.'),0);}
$('paginas-sem-texto').textContent='Páginas sem texto selecionável no PDF: '+deck.fontes.filter(f=>!window.TEXTO_PDF?.find(p=>p.pagina===f.pagina&&p.documento===f.documento)?.linhas.length).map(f=>f.pagina).join(', ')+'.';
function isManual(){return ['manual','manual-voz'].includes($('modo').value);}
let queue=[],index=0,flipped=false,review=false,shuffle=false;
let running=false,paused=false,stage='idle',epoch=0,delayTimer=null,delayRemaining=0,delayStarted=0,delayAction=null;

const levels=['muito_facil','facil','quase_facil','medio'];
function levelName(n){return {muito_facil:'Muito fácil',facil:'Fácil',quase_facil:'Quase fácil',medio:'Médio'}[n]||n;}
function sourceWord(c){return c.fonte.tipo==='livro'?'página':'slide';}
function updateSupport(){const c=current();$('pergunta-pt').textContent=c?(flipped?c.resposta_pt:c.pergunta_pt):'';$('resposta-pt').hidden=true;$('contexto-pt').hidden=true;$('portugues').title=$('pergunta-pt').textContent;}
function themeIcon(kind){const paths={rede:'<path d="M45 20h100M45 20v40m100-40v40M45 60h100"/><circle cx="45" cy="20" r="10"/><circle cx="145" cy="20" r="10"/><circle cx="45" cy="60" r="10"/><circle cx="145" cy="60" r="10"/>',formas:'<rect x="30" y="15" width="50" height="50"/><circle cx="140" cy="40" r="25"/>',tempo:'<path d="M15 45h180"/><circle cx="40" cy="45" r="8"/><circle cx="100" cy="45" r="8"/><circle cx="160" cy="45" r="8"/>'};return '<svg viewBox="0 0 220 80" aria-hidden="true"><g fill="var(--tint)" stroke="var(--accent)" stroke-width="3">'+(paths[kind]||paths.rede)+'</g></svg>';}
function renderActivity(c){const box=$('atividade');box.replaceChildren();if(!c||c.tipo==='pergunta')return;let count=0;
 const uncover=(button,text)=>{if(button.classList.contains('uncovered'))return;button.classList.add('uncovered');button.textContent=text;button.setAttribute('aria-label',text);count--;if(count===0)finishReveal();};
 if(c.tipo==='lacuna'){const phrase=document.createElement('p');phrase.className='cloze';box.append(phrase);for(const part of c.texto_es.split(/(\{\{.*?\}\})/g)){if(part.startsWith('{{')){const b=document.createElement('button'),term=part.slice(2,-2);count++;b.textContent='→ ____';b.setAttribute('aria-label','Revelar término '+count);b.onclick=()=>uncover(b,term);phrase.append(b);}else phrase.append(document.createTextNode(part));}}
 if(c.tipo==='oclusao'){
  const stage=document.createElement('div');stage.className='occlusion-stage';stage.tabIndex=0;stage.setAttribute('role','button');stage.setAttribute('aria-label','Revelar imagem e ler resposta; depois, próximo cartão');
  const img=document.createElement('img');img.src=c.imagem;img.alt=c.imagem_descricao;
  const crop=c.recorte||{x:0,y:0,w:1,h:1};
  img.onload=()=>{stage.style.aspectRatio=(img.naturalWidth*crop.w)+'/'+(img.naturalHeight*crop.h);};
  Object.assign(img.style,{position:'absolute',width:100/crop.w+'%',height:100/crop.h+'%',maxWidth:'none',left:-crop.x/crop.w*100+'%',top:-crop.y/crop.h*100+'%'});
  stage.append(img);box.append(stage);
  for(const [i,r]of c.oclusoes.entries()){
   const mask=document.createElement('span');mask.className='occlusion';mask.textContent='?';mask.setAttribute('aria-hidden','true');
   Object.assign(mask.style,{left:(r.x-crop.x)/crop.w*100+'%',top:(r.y-crop.y)/crop.h*100+'%',width:r.w/crop.w*100+'%',height:r.h/crop.h*100+'%'});stage.append(mask);
  }
  const activate=()=>{if(flipped)move(1);else flip();};
  stage.onclick=e=>{e.stopPropagation();if(!window.getSelection()?.toString())activate();};
  stage.onkeydown=e=>{if(e.key==='Enter'||e.code==='Space'){e.preventDefault();e.stopPropagation();activated=true;activate();}};
 }
 $('face').textContent=c.tipo==='oclusao'?'TOCA LA IMAGEN PARA REVELAR':'REVELA UNA PARTE CADA VEZ';
}
$('subir').onclick=()=>{const c=current();if(!c)return;const next=levels[levels.indexOf(c.nivel)+1];if(!next)return;$('nivel').value=next;const related=deck.cartoes.find(x=>x.grupo_nivel===c.grupo_nivel&&x.nivel===next);if(related){$('bloco').value=related.bloco;$('duvidas').checked=false;}rebuild();if(related){index=queue.findIndex(x=>x.id===related.id);render();}message(related?'Mesmo conceito no próximo nível.':'Próximo nível: '+levelName(next)+'. Não há variante deste conceito nessa etapa.');};

function message(s){$('mensagem').textContent=s;}
function toast(s){message(s);$('mensagem').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('mensagem').hidden=true;},4200);}
function day(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function afterDays(n){const d=new Date();d.setDate(d.getDate()+n);return day(d);}
function validDay(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00');return Number.isFinite(d.getTime())&&day(d)===s;}
function validateProgress(obj){if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Progresso inválido.');const result={};for(const [id,p] of Object.entries(obj)){if(!ids.has(id))throw Error('Há cartões de outro baralho.');if(!p||!['sei','duvida','ouvido'].includes(p.resultado)||!Number.isFinite(Date.parse(p.data))||!(p.proxima_revisao===null||validDay(p.proxima_revisao))||!Number.isInteger(p.etapa)||p.etapa<0||p.etapa>3)throw Error('Registro inválido: '+id);result[id]={resultado:p.resultado,data:p.data,proxima_revisao:p.proxima_revisao,etapa:p.etapa};if(p.ouvido_em&&Number.isFinite(Date.parse(p.ouvido_em)))result[id].ouvido_em=p.ouvido_em;if(p.ultima_exposicao==='ouvido')result[id].ultima_exposicao='ouvido';}return result;}
function exportData(){return {versao:1,assinatura:signature,titulo:deck.titulo,exportado_em:new Date().toISOString(),preferencias:prefs,cartoes:progress,tracos:ink.export()};}
function save(){try{localStorage.setItem(key,JSON.stringify(exportData()));storageOK=true;}catch{storageOK=false;toast('Não foi possível salvar: armazenamento indisponível ou cheio. Use Copiar progresso antes de fechar.');}$('salvamento').textContent=storageOK?'Progresso salvo neste navegador':'Use Copiar progresso · salvamento indisponível';updateSettings();return storageOK;}
function current(){return queue[index];}
function mix(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function ordered(cards){const out=cards.slice();if($('ordem').value==='gradual'){out.sort((a,b)=>a.fonte.pagina-b.fonte.pagina||a.ordem-b.ordem);if(shuffle)mix(out);}else{const blocks=deck.blocos.map(b=>out.filter(c=>c.bloco===b.id).sort((a,b)=>a.ordem-b.ordem));if(shuffle)blocks.forEach(mix);return blocks.flat();}return out;}
function rebuild(){stop(false);review=false;index=0;queue=ordered(deck.cartoes.filter(c=>($('bloco').value==='todos'||c.bloco===$('bloco').value)&&($('nivel').value==='todos'||c.nivel===$('nivel').value)&&(!$('duvidas').checked||progress[c.id]?.resultado==='duvida')));render();message('Primeira passagem por bloco. Erradas retornam nesta sessão e amanhã.');}
function blockTitle(c){return deck.blocos.find(b=>b.id===c.bloco)?.titulo||c.bloco;}
function symbol(v){return v?.svg||'';}
function render(){if(!running)cancelSound();const c=current(),empty=!c;flipped=false;$('ajuda').hidden=true;$('ajuda').textContent=c?.ajuda||'';$('onde').hidden=empty;clearHighlights();$('resposta').hidden=true;$('resposta-pt').hidden=true;$('contexto-pt').hidden=true;$('cartao').className='';const block=deck.blocos.find(b=>b.id===c?.bloco);document.querySelector('.study').dataset.cor=block?.cor||'azul';$('face').textContent='PIENSA EN LA RESPUESTA';$('posicao').textContent=`${empty?0:index+1}/${queue.length}`;$('vazio').hidden=!empty;for(const id of ['virar','anterior','proximo'])$(id).disabled=empty;$('sei').disabled=true;$('duvida').disabled=true;
$('tema').textContent=c?blockTitle(c):'Sem cartões';$('estado').textContent=c?levelName(c.nivel)+' · '+status(c):'';$('pergunta').textContent=c?.pergunta_es||'';$('texto-resposta').textContent=c?.resposta_es||'';$('contexto').textContent=c?.marca||c?.contexto_es||'';$('pergunta-pt').textContent=c?.pergunta_pt||'';$('resposta-pt').textContent=c?.resposta_pt||'';$('contexto-pt').textContent=c?.contexto_pt||'';$('visual').innerHTML=symbol(c?.visual)||themeIcon(block?.icone);renderActivity(c);$('cartao').classList.toggle('long',(c?.resposta_es.length||0)>155);applyMode();renderWarm();updateVoice();updateSupport();source();$('subir').disabled=!c||c.nivel==='medio';if(!running)manualRead('pergunta');}
function status(c){const p=progress[c.id];if(!p)return 'Ainda não avaliado';return `${{sei:'Acertei',duvida:'Errei',ouvido:'Ouvido · sem avaliação'}[p.resultado]}${p.proxima_revisao?' · '+p.proxima_revisao:''}`;}

function reveal(){if(!current())return;const pending=[...$('atividade').querySelectorAll('button:not(.uncovered)')];if(pending.length){pending[0].click();return;}finishReveal();}
function finishReveal(){for(const mask of $('atividade').querySelectorAll('.occlusion'))mask.classList.add('uncovered');const wasFlipped=flipped;flipped=true;$('ajuda').hidden=false;$('resposta').hidden=false;$('resposta-pt').hidden=false;$('contexto-pt').hidden=false;$('cartao').classList.add('revealed');$('face').textContent='RESPUESTA DE LA FUENTE';updateSupport();$('virar').textContent='Virar';const manual=isManual();$('sei').disabled=false;$('duvida').disabled=false;$('onde').hidden=false;applyMode();if(!wasFlipped&&playKind!=='auto'&&playKind!=='whole'){if(playKind==='manual')stop(false);manualRead('resposta');}}
function applyMode(){const mode=$('modo').value,auto=!isManual();
 $('parar').hidden=!running||playKind==='manual';$('reproduzir').hidden=false;
 const speaking=running&&playKind!=='auto';
 const label=speaking&&!paused?'Pausar fala':speaking?'Retomar fala':'Reproduzir fala';
 $('reproduzir').textContent=speaking&&!paused?'❚❚':'▶';
 const autoLabel=running&&playKind==='auto'?(paused?'Retomar reprodução automática':'Pausar reprodução automática'):'Iniciar reprodução automática';
 $('automatico').textContent=running&&playKind==='auto'&&!paused?'❚❚':'▶';$('automatico').title=autoLabel;$('automatico').setAttribute('aria-label',autoLabel);$('automatico').setAttribute('aria-pressed',String(running&&playKind==='auto'));$('reproduzir').title=label;$('reproduzir').setAttribute('aria-label',label);
 $('pausa-wrap').hidden=false;updateVoice();$('cartao').hidden=mode==='aquecimento';$('aquecimento').hidden=mode!=='aquecimento';$('virar').hidden=mode==='aquecimento';for(const id of ['sei','duvida'])$(id).hidden=!flipped;
 if(mode==='aquecimento'){$('resposta-pt').hidden=false;$('contexto-pt').hidden=false;}
 $('pt-toggle').textContent=prefs.pt?'Esconder apoio':'Mostrar apoio';$('pt-toggle').setAttribute('aria-expanded',String(prefs.pt));$('portugues').hidden=false;
 $('virar').textContent='Virar';$('virar').setAttribute('aria-pressed',String(flipped));
}
function renderWarm(){const list=$('aquecimento');list.replaceChildren();queue.forEach((c,i)=>{const item=document.createElement('div');item.className='warm-item'+(i===index?' current':'');item.dataset.index=i;const q=document.createElement('strong'),a=document.createElement('p');q.textContent=c.pergunta_es;a.textContent=c.resposta_es;item.append(q,a);list.append(item);});const active=list.children[index];if(active&&$('modo').value==='aquecimento')list.scrollTop=Math.max(0,active.offsetTop-list.offsetTop-25);}
let sourceBlock=null;
function clearHighlights(){document.querySelectorAll('.highlight').forEach(x=>x.remove());$('fonte-nota').textContent='Role para consultar';}
function source(){const c=current();if(!c){ink.reset();$('fonte').replaceChildren();sourceBlock=null;return;}const block=deck.blocos.find(b=>b.id===c.bloco);if(sourceBlock===c.bloco){const target=[...$('fonte').children].find(f=>Number(f.dataset.pagina)===c.fonte.pagina);if(target)$('fonte').scrollTop=target.offsetTop-$('fonte').offsetTop;return;}
 const pane=$('fonte');sourceBlock=c.bloco;ink.reset();pane.replaceChildren();
 for(const page of deck.fontes.filter(f=>f.documento===c.fonte.arquivo&&f.tipo===c.fonte.tipo&&(!block.paginas||block.paginas.includes(f.pagina)))){
 const figure=document.createElement('figure');figure.dataset.pagina=page.pagina;const caption=document.createElement('figcaption');caption.textContent=sourceWord(c)+' '+page.pagina;
 const stage=document.createElement('div');stage.className='source-page';const img=document.createElement('img');img.src=page.arquivo;img.alt=page.descricao;img.loading='lazy';img.decoding='async';img.width=page.largura||1100;img.height=page.altura||618;stage.append(img);figure.dataset.cartaoId=c.id;figure.dataset.tipo=page.tipo;figure.append(stage);pane.append(figure);ink.mount(stage,page);}
 const target=[...pane.children].find(f=>Number(f.dataset.pagina)===c.fonte.pagina);pane.scrollTop=target?.offsetTop-pane.offsetTop||0;ink.refresh();
}
function locate(){const c=current();if(!c)return;prefs.fonte=true;$('mostrar-fonte').checked=true;updateSettings();source();clearHighlights();const pane=$('fonte'),figure=[...pane.children].find(x=>Number(x.dataset.pagina)===c.fonte.pagina),stage=figure?.querySelector('.source-page');if(!stage)return;
 for(const r of c.retangulos){const el=document.createElement('div');el.className='highlight';Object.assign(el.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.w*100+'%',height:r.h*100+'%'});stage.append(el);}
 const first=c.retangulos[0];pane.scrollTop=Math.max(0,pane.scrollTop+stage.getBoundingClientRect().top-pane.getBoundingClientRect().top+(first?.y||0)*stage.clientHeight-Math.min(60,pane.clientHeight*.18));
 $('fonte-nota').textContent=c.verificado?'Trecho em amarelo':'A verificar · apoio indireto';
}
function move(delta,automatic=false){if(!automatic)stop(false);if(!queue.length)return;if(index+delta>=queue.length){stop(false);message(review?'Revisão concluída.':'Fim desta passagem. As erradas retornam amanhã; você pode navegar pelos cartões.');return;}index=Math.max(0,index+delta);render();}
function mark(result){const c=current();if(!c||!flipped)return;const old=progress[c.id];let step=0;if(result==='sei')step=old?.resultado==='sei'?(day(new Date(old.data))===day()?old.etapa:Math.min(3,old.etapa+1)):1;progress[c.id]={resultado:result,data:new Date().toISOString(),proxima_revisao:afterDays(result==='duvida'?1:[0,3,7,14][step]),etapa:step,...(old?.ouvido_em?{ouvido_em:old.ouvido_em}:{})};save();if(result==='duvida'&&!queue.slice(index+1).some(x=>x.id===c.id)){let at=Math.min(queue.length,index+4);if(!review&&$('ordem').value==='tema'){const end=queue.findIndex((x,i)=>i>index&&x.bloco!==c.bloco);if(end>=0)at=Math.min(at,end);}queue.splice(at,0,c);}const note=result==='duvida'?'Errei: volta nesta sessão e amanhã.':'Acertei: próxima revisão em '+[0,3,7,14][step]+' dias.';if(index===queue.length-1){$('estado').textContent=status(c);$('sei').disabled=true;$('duvida').disabled=true;message(note+' Passagem concluída.');}else{move(1);message(note);}}
function heard(){const c=current();if(!c)return;const now=new Date().toISOString();const old=progress[c.id];progress[c.id]=old?{...old,ouvido_em:now,ultima_exposicao:'ouvido'}:{resultado:'ouvido',data:now,proxima_revisao:null,etapa:0,ouvido_em:now,ultima_exposicao:'ouvido'};save();$('estado').textContent='Ouvido · não conta como domínio';}
const hasAudio=!!deck.audio?.arquivo;
const player=new Audio();player.preload='auto';if(hasAudio)player.src=deck.audio.arquivo;
let frame=null,cutTimer=null,segmentEnd=null,segmentDone=null,playKind=null;
function updateVoice(){
 $('voz').textContent=hasAudio?'Áudio do Speechify':'Sem áudio do Speechify neste baralho';
 $('arquivo-audio').textContent=hasAudio?deck.audio.arquivo.split('/').pop():'';
 $('reproduzir').disabled=!hasAudio||(!current()&&!running);if(!hasAudio){$('reproduzir').title='Este baralho não tem arquivo de áudio';$('reproduzir').setAttribute('aria-label',$('reproduzir').title);}
 $('automatico').disabled=!hasAudio||!current();if(!hasAudio){$('automatico').title='Este baralho não tem arquivo de áudio para reprodução automática';$('automatico').setAttribute('aria-label',$('automatico').title);}
 $('ouvir-tudo').disabled=!hasAudio;

 $('justificativa').disabled=!hasAudio||!deck.audio.com_justificativa;
}
function clearDelay(){if(delayTimer!==null)clearTimeout(delayTimer);delayTimer=null;delayAction=null;delayRemaining=0;}
function wait(ms,fn){clearDelay();delayRemaining=ms;delayAction=fn;delayStarted=performance.now();delayTimer=setTimeout(()=>{delayTimer=null;delayAction=null;fn();},ms);}
function clearWatch(){cancelAnimationFrame(frame);clearTimeout(cutTimer);frame=null;cutTimer=null;}
function cancelSound(){clearWatch();player.pause();segmentDone=null;segmentEnd=null;}
function stop(show=true){epoch++;running=false;paused=false;stage='idle';playKind=null;clearDelay();cancelSound();applyMode();if(show)message('Parado. Você pode continuar no modo manual.');}
function fail(reason){stop(false);toast(reason+' A reprodução foi parada.');}
function watch(){
 clearWatch();if(!running||paused||segmentEnd===null)return;
 const remaining=segmentEnd-player.currentTime;
 if(remaining<=.008){const fn=segmentDone;clearWatch();player.pause();player.currentTime=segmentEnd;segmentDone=null;segmentEnd=null;fn?.();return;}
 frame=requestAnimationFrame(watch);
 // Segunda barreira, mesmo se o navegador atrasar um quadro.
 cutTimer=setTimeout(watch,Math.max(1,remaining*1000-8));
}
function playRange(range,next){
 cancelSound();const token=epoch;
 if(!hasAudio||!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||range[0]<0||range[1]<=range[0]){fail('Sem tempos válidos para esta fala');return;}
 segmentEnd=range[1];segmentDone=()=>{if(token===epoch&&running)next();};
 player.currentTime=range[0];player.play().then(()=>{if(token!==epoch||!running){return;}if(paused){player.pause();return;}watch();}).catch(()=>{if(token===epoch)fail('Não foi possível tocar o MP3. Tente novamente');});
}
player.addEventListener('error',()=>{if(running)fail('Não foi possível abrir o MP3 do Speechify');});
player.addEventListener('ended',()=>{if(playKind==='whole'){stop(false);message('MP3 inteiro concluído.');}else if(running&&segmentEnd!==null){if(player.currentTime>=segmentEnd-.035){const fn=segmentDone;cancelSound();fn?.();}else fail('O MP3 terminou antes do limite da fala');}});
player.addEventListener('seeked',()=>{if(running&&!paused&&playKind!=='whole')watch();});
function pauseSeconds(){const n=Number($('pausa').value);return [0,.5,1,2,3,5].includes(n)?n:1;}
function wants(part){return prefs.ler==='ambas'||prefs.ler===part;}
function manualRead(part,forced=false){
 if((!forced&&!isManual())||!current()||(!forced&&($('modo').value!=='manual-voz'||!activated||!wants(part))))return;
 stop(false);if(!hasAudio)return;running=true;playKind='manual';stage=part;applyMode();
 playRange(current().tempos?.[part],()=>{
  if(part==='resposta'&&prefs.justificativa&&deck.audio.com_justificativa){stage='justificativa';playRange(current().tempos?.justificativa,()=>stop(false));}
  else stop(false);
 });
}
function automaticPart(part){
 if(!running||!current())return;stage=part;
 if(part==='resposta'){
  for(const b of $('atividade').querySelectorAll('button:not(.uncovered)'))b.click();
  finishReveal();
 }
 message(part==='pergunta'?'Ouvindo pergunta.':part==='resposta'?'Ouvindo resposta.':'Ouvindo justificativa.');
 playRange(current().tempos?.[part],()=>{
  if(part==='pergunta')wait(pauseSeconds()*1000,()=>automaticPart('resposta'));
  else if(part==='resposta'){locate();if(prefs.justificativa&&deck.audio.com_justificativa)wait(pauseSeconds()*1000,()=>automaticPart('justificativa'));else automaticNext();}
  else automaticNext();
 });
}
function automaticNext(){heard();if(index+1>=queue.length){stop(false);message('Passagem ouvida. Isso não foi registrado como “Acertei”.');return;}wait(pauseSeconds()*1000,()=>{index++;render();automaticPart('pergunta');});}
function start(){if(!hasAudio||!current()){message('Sem áudio do Speechify neste baralho');return;}stop(false);running=true;playKind='auto';render();applyMode();automaticPart('pergunta');}
function togglePause(){
 if(!running)return;paused=!paused;
 if(paused){clearWatch();player.pause();if(delayTimer!==null){clearTimeout(delayTimer);delayTimer=null;delayRemaining=Math.max(0,delayRemaining-(performance.now()-delayStarted));}message('Pausado. Use Retomar para continuar.');}
 else {if(delayAction){const fn=delayAction;wait(delayRemaining,fn);}else player.play().then(()=>{if(paused)player.pause();else if(playKind!=='whole')watch();}).catch(()=>fail('Não foi possível retomar o áudio'));}
 applyMode();
}
function flip(){
 if(!current())return;
 if(flipped){stop(false);render();return;}
 stop(false);for(const b of $('atividade').querySelectorAll('button:not(.uncovered)'))b.click();finishReveal();locate();
}
function thought(){flip();}
function playCurrent(){if(running&&playKind!=='auto'){togglePause();return;}manualRead(flipped?'resposta':'pergunta',true);}
// O primeiro gesto libera a leitura inicial sem tentar autoplay na abertura.
document.addEventListener('click',e=>{
 if(activated)return;activated=true;
 if(e.target.closest('button,input,select,textarea,a,#cartao'))return;
 manualRead(flipped?'resposta':'pergunta');
},true);
$('cartao').addEventListener('click',e=>{
 if(e.target.closest('button,input,select,textarea,a,[contenteditable],.occlusion,.cloze button'))return;
 if(window.getSelection()?.toString())return;
 flip();
});
function whole(){
 if(!hasAudio)return;stop(false);running=true;playKind='whole';stage='whole';player.currentTime=0;
 player.play().catch(()=>fail('Não foi possível tocar o MP3'));applyMode();message('Ouvindo o MP3 inteiro, do início.');
}
// Uma aba oculta suspende a reprodução para manter a barreira entre falas.
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)togglePause();});
for(const [id,field] of [['ler','ler'],['pausa','pausa'],['justificativa','justificativa']])$(id).addEventListener('change',()=>{
 prefs[field]=id==='justificativa'?$('justificativa').checked:id==='pausa'?pauseSeconds():$('ler').value;save();
});
$('ler').value=prefs.ler;$('pausa').value=prefs.pausa;$('justificativa').checked=prefs.justificativa;
$('automatico').onclick=()=>{if(running&&playKind==='auto')togglePause();else start();};
 $('reproduzir').onclick=playCurrent;$('ouvir-tudo').onclick=whole;
for(const id of ['bloco','ordem','duvidas','nivel'])$(id).addEventListener('change',rebuild);
$('modo').addEventListener('change',()=>{stop(false);render();message(isManual()?'Vire antes de marcar Acertei ou Errei.':'Use Iniciar sequência automática. Ouvir não conta como domínio.');});

$('embaralhar').onclick=()=>{shuffle=!shuffle;$('embaralhar').textContent=shuffle?'Embaralhar ✓':'Embaralhar';$('embaralhar').setAttribute('aria-pressed',String(shuffle));rebuild();};
$('virar').onclick=flip;$('sei').onclick=()=>mark('sei');$('duvida').onclick=()=>mark('duvida');$('anterior').onclick=()=>move(-1);$('proximo').onclick=()=>move(1);$('parar').onclick=()=>stop();
$('pt-toggle').onclick=()=>{prefs.pt=!prefs.pt;applyMode();save();};
$('onde').onclick=locate;
$('revisar').onclick=()=>{stop(false);const due=deck.cartoes.filter(c=>progress[c.id]?.proxima_revisao&&progress[c.id].proxima_revisao<=day());queue=mix(due).slice(0,15);index=0;review=true;$('modo').value=hasAudio?'manual-voz':'manual';render();message(queue.length?'Revisão misturada entre todos os blocos, até 15 por vez.':'Nenhuma revisão venceu hoje. A primeira passagem continua nos filtros acima.');};
function dialog(kind){stop(false);$('dialog-status').textContent='';const copying=kind==='copiar';$('dialog-titulo').textContent=copying?'Copiar progresso':'Colar progresso';$('dialog-instrucao').textContent=copying?'Guarde este texto. Se a cópia automática falhar, selecione e copie manualmente.':'Cole o texto exportado por esta prévia. Os registros importados substituirão os registros de mesmos cartões.';$('progresso-texto').value=copying?JSON.stringify(exportData(),null,2):'';$('progresso-texto').readOnly=copying;$('importar').hidden=copying;$('progresso-dialog').showModal();$('progresso-texto').focus();if(copying){$('progresso-texto').select();try{if(navigator.clipboard?.writeText)navigator.clipboard.writeText($('progresso-texto').value).then(()=>{$('dialog-status').textContent='Copiado. Guarde em um arquivo de texto.';}).catch(()=>{$('dialog-status').textContent='Selecione o texto e copie com Ctrl+C ou ⌘C.';});else $('dialog-status').textContent='Selecione o texto e copie com Ctrl+C ou ⌘C.';}catch{$('dialog-status').textContent='Copie o texto manualmente.';}}}
let pendingImport=null;
$('copiar').onclick=()=>dialog('copiar');$('colar').onclick=()=>{pendingImport=null;$('importar').textContent='Conferir progresso';dialog('colar');};
$('progresso-texto').addEventListener('input',()=>{pendingImport=null;$('importar').textContent='Conferir progresso';$('dialog-status').textContent='';});
$('importar').onclick=()=>{try{
 const raw=$('progresso-texto').value;
 const data=JSON.parse(raw);
 if(data.versao!==1||data.assinatura!==signature)throw Error('Esse progresso pertence a outro baralho ou versão.');
 const validated=validateProgress(data.cartoes);const tracos=data.tracos===undefined?null:ink.validate(data.tracos);const mergedTracos=tracos?ink.validate({...ink.export(),...tracos}):null;
 if(!Object.keys(validated).length&&!Object.keys(tracos||{}).length)throw Error('Não há registros de cartões neste progresso.');
 if(pendingImport!==raw){pendingImport=raw;const rows=Object.entries(validated).map(([id,p])=>id+': '+(progress[id]?progress[id].resultado+' / revisão '+(progress[id].proxima_revisao||'sem data')+' / etapa '+progress[id].etapa:'sem registro')+' → '+p.resultado+' / revisão '+(p.proxima_revisao||'sem data')+' / etapa '+p.etapa);$('dialog-status').textContent='Serão substituídos '+rows.length+' registros. Os outros serão mantidos. Suas preferências atuais serão mantidas.\n'+rows.join('\n')+(tracos?'\nTraços: substituir as anotações de '+Object.keys(tracos).length+' páginas incluídas; demais páginas mantidas.':'\nEste arquivo não altera os traços.');$('importar').textContent='Confirmar substituição';return;}
 progress={...progress,...validated};if(mergedTracos)ink.load(mergedTracos);pendingImport=null;const persisted=save();$('progresso-dialog').close();rebuild();toast(persisted?'Progresso restaurado.':'Progresso restaurado somente nesta sessão; não foi possível salvar. Use Copiar progresso antes de fechar.');
 }catch(e){pendingImport=null;$('importar').textContent='Conferir progresso';$('dialog-status').textContent='Não foi possível restaurar: '+e.message;}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('config-dialog').open&&!$('progresso-dialog').open){e.preventDefault();$('config-dialog').close();return;}if(e.target.closest('.source')||window.getSelection()?.toString())return;if(e.target.closest('textarea,[contenteditable]:not([contenteditable=false]),input:not([type=checkbox]):not([type=button])')||$('progresso-dialog').open||$('config-dialog').open)return;if(e.target.closest('select')&&e.code!=='Space')return;if(e.code==='Space'&&e.target.closest('select,input'))return;if(e.code==='Space'){e.preventDefault();activated=true;flip();}if(e.key.toLowerCase()==='o'){e.preventDefault();locate();}if(e.key==='1')mark('sei');if(e.key==='2')mark('duvida');if(e.key==='ArrowLeft'){e.preventDefault();activated=true;move(-1);}if(e.key==='ArrowRight'){e.preventDefault();activated=true;move(1);}});
try{if('mediaSession'in navigator){for(const [name,fn]of Object.entries({play:()=>{activated=true;if(paused)togglePause();else if(!running)playCurrent();},pause:()=>{if(running&&!paused)togglePause();},nexttrack:thought,previoustrack:()=>{stop(false);move(-1);}})){try{navigator.mediaSession.setActionHandler(name,fn);}catch{}}}}catch{}
window.addEventListener('pagehide',()=>{stop(false);save();});
function rememberSettings(){for(const id of ['modo','ordem','bloco','nivel'])prefs[id]=$(id).value;prefs.duvidas=$('duvidas').checked;prefs.shuffle=shuffle;save();}
function updateSettings(){
 const due=deck.cartoes.filter(c=>progress[c.id]?.proxima_revisao&&progress[c.id].proxima_revisao<=day()).length;
 $('revisao-ponto').hidden=!due;$('configurar').title=due?'Configurar · '+due+' para revisar hoje':'Configurar';
 const scope=review?'revisar hoje':$('duvidas').checked?'Só erradas':'tudo';
 $('config-resumo').textContent=$('modo').selectedOptions[0].text+' · '+scope+' · '+$('bloco').selectedOptions[0].text+' · '+$('nivel').selectedOptions[0].text;
 document.querySelector('.source').hidden=prefs.fonte===false;document.querySelector('main').classList.toggle('sem-fonte',prefs.fonte===false);
}
$('titulo').textContent=deck.titulo;document.title=deck.titulo+' · Flashcards ativos';document.querySelector('.eyebrow').textContent=`PRÉVIA · ${new Set(deck.cartoes.map(c=>c.fonte.arquivo+'|'+c.fonte.pagina)).size} FONTES / ${deck.cartoes.length} CARTÕES`;
$('modo').value=hasAudio?'manual-voz':'manual';
for(const b of deck.blocos){const o=document.createElement('option');o.value=b.id;o.textContent=b.titulo;$('bloco').append(o);}
for(const id of ['modo','ordem','bloco','nivel']){if([...$(id).options].some(o=>o.value===storedPrefs[id]))$(id).value=storedPrefs[id];}
$('duvidas').checked=storedPrefs.duvidas===true;shuffle=storedPrefs.shuffle===true;prefs.fonte=storedPrefs.fonte!==false;$('mostrar-fonte').checked=prefs.fonte;
$('embaralhar').textContent=shuffle?'Embaralhar ✓':'Embaralhar';
for(const id of ['modo','ordem','bloco','nivel','duvidas','ler','pausa','justificativa'])$(id).addEventListener('change',()=>{rememberSettings();});
for(const id of ['subir','embaralhar','revisar'])$(id).addEventListener('click',rememberSettings);
$('mostrar-fonte').onchange=()=>{prefs.fonte=$('mostrar-fonte').checked;save();};
$('tudo').onclick=()=>{$('bloco').value='todos';$('nivel').value='todos';$('duvidas').checked=false;rebuild();rememberSettings();};
$('configurar').onclick=()=>{updateSettings();$('config-dialog').showModal();};
$('config-fechar').onclick=()=>$('config-dialog').close();
for(const id of ['config-dialog','progresso-dialog'])$(id).addEventListener('click',e=>{if(e.target===$(id)){const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$(id).close();}});
rebuild();save();
})();
