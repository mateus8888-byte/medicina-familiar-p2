'use strict';
(() => {
const $=id=>document.getElementById(id), perguntas=window.QUESTOES, meta=window.METADADOS;
const KEY='questoes-ativas-p2-'+window.VERSAO_BANCO;
const letras=['A','B','C','D'], niveis={todos:'Todos os níveis',muito_facil:'Muito fácil',facil:'Fácil',medio:'Médio',dificil:'Difícil'};
const porId=new Map(perguntas.map(q=>[q.id,q])), ids=perguntas.map(q=>q.id);
const modos=['clique','sempre','cabeca','auto'],ritmos={devagar:1.5,normal:1,rapido:.7};
let estado={respostas:{},vf:{},reveladas:{},vistas:{},dicas:{},auto:{},fila:ids.slice(),indice:0,fim:false,desenhos:{},fonte:true,nivel:'todos',tema:'todos',modo:'clique',ritmo:'normal',revisao:false,destaque:null};
let fase=0,tocando=false;
let aviso='';
try {
 const s=JSON.parse(localStorage.getItem(KEY));
 if(s&&typeof s==='object'){
  if(Object.hasOwn(niveis,s.nivel))estado.nivel=s.nivel;
  if(perguntas.some(q=>meta[q.id].tema===s.tema))estado.tema=s.tema;
  if(modos.includes(s.modo))estado.modo=s.modo;
  if(Object.hasOwn(ritmos,s.ritmo))estado.ritmo=s.ritmo;
  for(const q of perguntas){
   if(letras.includes(s.respostas?.[q.id]))estado.respostas[q.id]=s.respostas[q.id];
   if(s.reveladas?.[q.id]===true)estado.reveladas[q.id]=true;
   if(s.vistas?.[q.id]===true)estado.vistas[q.id]=true;
   if(s.dicas?.[q.id]===true)estado.dicas[q.id]=true;
   if(['acertei','errei'].includes(s.auto?.[q.id]))estado.auto[q.id]=s.auto[q.id];
   if(Array.isArray(s.vf?.[q.id]))estado.vf[q.id]=Array.from({length:q.itens?.length||0},(_,i)=>['V','F'].includes(s.vf[q.id][i])?s.vf[q.id][i]:null);
  }
  const permitidos=filtradas();
  if(Array.isArray(s.fila)&&s.fila.length&&s.fila.every(id=>permitidos.includes(id))&&new Set(s.fila).size===s.fila.length){estado.fila=s.fila;estado.revisao=s.revisao===true;}
  else estado.fila=permitidos;
  estado.indice=Math.max(0,Math.min(estado.fila.length-1,Number.isInteger(s.indice)?s.indice:0));
  estado.fim=s.fim===true;
  estado.desenhos=s.desenhos||{};estado.fonte=s.fonte!==false;
  estado.destaque=porId.has(s.destaque)?s.destaque:null;
 }
} catch {aviso='Não foi possível recuperar o progresso anterior.';}
function filtradas(){return perguntas.filter(q=>(estado.nivel==='todos'||q.nivel===estado.nivel)&&(estado.tema==='todos'||meta[q.id].tema===estado.tema)).map(q=>q.id);}
function situacao(id){const r=estado.respostas[id];if(r)return r===porId.get(id).correta?'certa':'errada';if(estado.auto[id])return estado.auto[id]==='acertei'?'certa':'errada';return 'passada';}
function avisar(t){$('mensagem').textContent=t;$('mensagem').hidden=false;}
const ink=window.criarFerramentasFonte({deck:{fontes:window.FONTES},avisar,salvar});
try{ink.load(estado.desenhos);}catch{estado.desenhos={};ink.load({});aviso='Traços inválidos não foram recuperados; suas respostas foram mantidas.';}
function salvar(){
 estado.desenhos=ink.export();
 try{localStorage.setItem(KEY,JSON.stringify(estado));$('salvamento').textContent='Salvo neste navegador.';}
 catch{avisar('Não foi possível salvar. Mantenha esta página aberta.');$('salvamento').textContent='Armazenamento indisponível.';}
}
function atual(){return porId.get(estado.fila[estado.indice]);}
function el(tag,texto,classe){const e=document.createElement(tag);if(texto!==undefined)e.textContent=texto;if(classe)e.className=classe;return e;}
function aplicarFonte(){document.querySelector('.source').hidden=!estado.fonte;document.querySelector('main').classList.toggle('sem-fonte',!estado.fonte);$('mostrar-fonte').checked=estado.fonte;ink.refresh();}
for(const p of window.FONTES){
 const figure=el('figure');figure.dataset.pagina=p.pagina;
 const stage=el('div',undefined,'source-page'),img=el('img');
 img.src=p.arquivo;img.alt=p.descricao;img.width=p.largura;img.height=p.altura;img.decoding='async';img.loading='lazy';
 stage.append(img);figure.append(el('figcaption','Página '+p.pagina),stage);$('fonte').append(figure);ink.mount(stage,p);
 img.addEventListener('load',()=>ink.refresh());
}
function limparDestaque(){document.querySelectorAll('.highlight').forEach(e=>e.remove());$('fonte-nota').textContent='';}
function paginaFonte(numero){
 const pane=$('fonte'),figure=pane.querySelector(`[data-pagina="${numero}"]`);
 if(!figure){avisar('Página da fonte indisponível.');return null;}
 pane.scrollTop+=figure.getBoundingClientRect().top-pane.getBoundingClientRect().top;ink.refresh();return figure.querySelector('.source-page');
}
function localizar(q){
 estado.fonte=true;aplicarFonte();limparDestaque();const stage=paginaFonte(q.pagina);if(!stage)return;
 const m=meta[q.id],rects=m.retangulos;
 for(const trecho of m.trechos){
  const target=$('fonte').querySelector(`[data-pagina="${trecho.pagina}"] .source-page`);
  if(!target)continue;
  for(const r of trecho.retangulos){const h=el('div',undefined,'highlight');Object.assign(h.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.w*100+'%',height:r.h*100+'%'});target.append(h);}
 }
 const first=rects[0],pane=$('fonte');
 pane.scrollTop+=stage.getBoundingClientRect().top-pane.getBoundingClientRect().top+first.y*stage.clientHeight-Math.min(60,pane.clientHeight*.18);
 $('fonte-nota').textContent=`Página ${q.pagina}${m.trechos.length>1?' · Apoio: '+m.trechos.slice(1).map(t=>t.pagina).join(', '):''} · ${m.localizacao==='exato'?'Trecho em amarelo':'Localização aproximada: página marcada; trecho exato não localizado.'}`;
 estado.destaque=q.id;salvar();
}
function atualizarSequencia(q){
 const v=estado.vf[q.id]||[],seq=v.length===4&&v.every(x=>x==='V'||x==='F')?v.join(''):'';
 for(const b of $('alternativas').children)b.classList.toggle('sequencia',!estado.respostas[q.id]&&!!seq&&q.alternativas[b.dataset.letra].replace(/[^VF]/g,'')===seq);
}
function itens(q){
 const c=$('itens');c.replaceChildren();c.className=q.formato==='asociacion'?'associacao':'';
 if(!q.itens)return;
 const cols=q.formato==='asociacion'?[el('div',undefined,'coluna'),el('div',undefined,'coluna')]:[];
 c.append(...cols);
 q.itens.forEach((texto,i)=>{
  const row=el('div',undefined,'item');
  if(q.formato==='vf'){
   const botoes=el('div',undefined,'vf-botoes');
   for(const v of ['V','F']){
    const b=el('button',v);b.type='button';b.setAttribute('aria-label',`Item ${i+1}: ${v==='V'?'verdadero':'falso'}`);b.setAttribute('aria-pressed',String(estado.vf[q.id]?.[i]===v));b.disabled=!!estado.respostas[q.id];
    b.onclick=()=>{estado.vf[q.id]||=Array(4).fill(null);estado.vf[q.id][i]=v;salvar();for(const x of botoes.children)x.setAttribute('aria-pressed',String(x===b));atualizarSequencia(q);};botoes.append(b);
   }row.append(botoes);
  }
  row.append(el('p',texto));(cols.length?cols[i<4?0:1]:c).append(row);
 });
}
function render(){
 const q=atual();if(!q){avisar('Não há questões neste filtro.');return;}
 limparDestaque();$('cartao').scrollTop=0;$('fim').hidden=!estado.fim;$('questao').hidden=estado.fim;
 $('anterior').disabled=!estado.fim&&estado.indice===0;$('proximo').disabled=estado.fim;
 const automatico=estado.modo==='auto';$('reproduzir').hidden=estado.fim;$('reproduzir').textContent=tocando?'❚❚':'▶';$('reproduzir').title=tocando?'Pausar':automatico?'Tocar sozinho':'Ler a pergunta';$('reproduzir').setAttribute('aria-label',$('reproduzir').title);
 $('proximo').title=estado.indice===estado.fila.length-1?'Ver resultado':'Passar';$('proximo').setAttribute('aria-label',$('proximo').title);
 $('posicao').textContent=estado.fim?'Passagem concluída':`${estado.indice+1} / ${estado.fila.length}${estado.revisao?' · Revisão':''}${estado.nivel==='todos'?'':' · '+niveis[estado.nivel]}`;
 $('nivel-filtro').value=estado.nivel;$('tema-filtro').value=estado.tema;$('modo').value=estado.modo;$('ritmo').value=estado.ritmo;$('ritmo-linha').hidden=!automatico;
 if(estado.fim){renderFim();salvar();return;}
 $('identificacao').textContent=`${meta[q.id].tema} · ${niveis[q.nivel]}`;
 $('pergunta').textContent=q.enunciado;itens(q);
 $('caso-didatico').hidden=!q.caso_didatico;
 $('dica-texto').hidden=!estado.dicas[q.id];$('dica-texto').textContent=q.dica;$('dica').setAttribute('aria-expanded',String(!!estado.dicas[q.id]));
 const resposta=estado.respostas[q.id],julgada=estado.auto[q.id],cabeca=estado.modo==='cabeca'&&!resposta;
 const vista=automatico?fase===2:cabeca&&estado.reveladas[q.id]&&!!(julgada||estado.vistas[q.id]);
 const revelada=automatico?fase>0:cabeca?vista:estado.modo==='sempre'||estado.reveladas[q.id]||!!resposta;
 $('ver-alternativas').hidden=automatico||revelada||cabeca;$('ver-resposta').hidden=!cabeca||vista;$('alternativas').hidden=!revelada;$('alternativas').replaceChildren();
 $('julgar').hidden=!cabeca||!vista;$('acertei').setAttribute('aria-pressed',String(julgada==='acertei'));$('errei').setAttribute('aria-pressed',String(julgada==='errei'));
 for(const letra of letras){
  const b=el('button');b.dataset.letra=letra;b.type='button';b.append(el('span',letra,'letra'),el('span',q.alternativas[letra]));b.disabled=!!resposta||vista||automatico;
  if(automatico&&fase===1){b.classList.add('entrando');b.style.animationDelay=letras.indexOf(letra)*.6+'s';}
  if(vista&&letra===q.correta){b.classList.add('certa');b.append(el('span','Correta','etiqueta'));}
  if(resposta){if(letra===q.correta){b.classList.add('certa');b.append(el('span','Correta','etiqueta'));}if(letra===resposta){if(letra!==q.correta)b.classList.add('errada');b.append(el('span','Sua resposta','etiqueta'));}}
  b.onclick=()=>{if(estado.respostas[q.id])return;estado.respostas[q.id]=letra;salvar();render();lerManual('r');};$('alternativas').append(b);
 }
 if(q.formato==='vf')atualizarSequencia(q);
 const aberta=!!resposta||vista;$('correcao').hidden=!aberta;$('resultado').textContent=resposta?(resposta===q.correta?'Você acertou.':`Você errou. Resposta correta: ${q.correta}.`):vista?`Resposta correta: ${q.correta}.`:'';
 $('justificativa').textContent=aberta?q.justificativa_pt:'';
 $('gabarito-vf').hidden=!aberta||!q.gabarito_vf;$('gabarito-vf').textContent=aberta&&q.gabarito_vf?'Gabarito: '+q.gabarito_vf.join(' - '):'';
 $('onde').onclick=()=>localizar(q);$('dica').onclick=()=>{estado.dicas[q.id]=!estado.dicas[q.id];$('dica-texto').hidden=!estado.dicas[q.id];$('dica').setAttribute('aria-expanded',String(!!estado.dicas[q.id]));salvar();};
 if(estado.destaque===q.id||(automatico&&fase===2))localizar(q);else paginaFonte(q.pagina);
 salvar();
}
function erradas(){return estado.fila.filter(id=>situacao(id)==='errada');}
function passadas(){return estado.fila.filter(id=>situacao(id)==='passada');}
function renderFim(){
 const erros=erradas(),puladas=passadas();$('placar').textContent=`${estado.fila.length-erros.length-puladas.length} de ${estado.fila.length} acertos, ${erros.length} erros, ${puladas.length} passadas.`;$('refazer-passadas').hidden=!puladas.length;$('erros').replaceChildren();
 if(!erros.length)$('erros').append(el('p','Nenhum erro nesta passagem.'));
 for(const id of erros){const q=porId.get(id),row=el('div',undefined,'erro');row.dataset.id=id;
  row.append(el('strong',`Questão ${id} · ${meta[id].tema}`),el('p',q.enunciado),el('p',`${estado.respostas[id]?'Sua resposta: '+estado.respostas[id]:'Marcou Errei'} · Correta: ${q.correta} — ${q.alternativas[q.correta]}`),el('p',q.justificativa_pt),el('p',`Página ${q.pagina}`));
  const b=el('button','Onde está');b.onclick=()=>localizar(q);row.append(b);$('erros').append(row);
 }$('refazer').hidden=!erros.length;
}
$('ver-alternativas').onclick=()=>{estado.reveladas[atual().id]=true;salvar();$('ver-alternativas').hidden=true;$('alternativas').hidden=false;};
$('ver-resposta').onclick=()=>{const id=atual().id;estado.reveladas[id]=true;estado.vistas[id]=true;render();lerManual('r');};
for(const [botao,valor] of [['acertei','acertei'],['errei','errei']])$(botao).onclick=()=>{estado.auto[atual().id]=valor;avancar();lerManual('p');};
function avancar(){if(estado.indice===estado.fila.length-1)estado.fim=true;else estado.indice++;fase=0;render();}
$('anterior').onclick=()=>{pararAuto();if(estado.fim)estado.fim=false;else estado.indice=Math.max(0,estado.indice-1);fase=0;render();lerManual('p');};
$('proximo').onclick=()=>{const seguia=tocando;pararAuto();avancar();if(seguia&&!estado.fim)tocar();else lerManual('p');};
const voz=window.VOZ||{},player=new Audio(),blobs={},pausas={devagar:5000,normal:2500,rapido:1000};
let sessao=0,arquivoAtual=null;
function dormir(ms){return new Promise(r=>setTimeout(r,ms));}
async function carregar(arq){
 blobs[arq]||=URL.createObjectURL(await(await fetch(arq)).blob());
 if(arquivoAtual===arq)return;
 arquivoAtual=arq;player.src=blobs[arq];
 await new Promise((ok,erro)=>{player.onloadedmetadata=ok;player.onerror=erro;});
}
async function falar(q,parte,s){
 const v=voz[q.id];
 if(!v)return dormir(Math.max(4,(parte==='p'?q.enunciado:q.justificativa_pt).length/14)*1000*ritmos[estado.ritmo]);
 try{await carregar(v.a);}catch{avisar('Não foi possível tocar o áudio.');return dormir(3000);}
 if(s!==sessao)return;
 player.currentTime=v[parte][0];
 try{await player.play();}catch{if(s===sessao){pararAuto();render();avisar('O navegador não deixou tocar. Aperte ▶ de novo.');}return;}
 await new Promise(fim=>{const vigia=setInterval(()=>{if(s!==sessao||player.ended||player.currentTime>=v[parte][1]){clearInterval(vigia);if(s===sessao)player.pause();fim();}},40);});
}
function pararAuto(){tocando=false;sessao++;player.pause();}
function lerManual(parte){if(estado.modo==='auto'||estado.fim)return;const s=++sessao;player.pause();falar(atual(),parte,s);}
async function passo(s){
 while(tocando&&s===sessao){
  const q=atual();
  if(fase===0)await falar(q,'p',s);else if(fase===1)await dormir(3000);else{await falar(q,'r',s);if(s===sessao)await dormir(pausas[estado.ritmo]);}
  if(!tocando||s!==sessao)return;
  if(fase<2){fase++;render();continue;}
  if(estado.indice===estado.fila.length-1){pararAuto();fase=0;avisar('Fim da lista. O automático não conta acerto nem erro.');render();return;}
  estado.indice++;fase=0;render();
 }
}
function tocar(){tocando=true;render();passo(++sessao);}
$('reproduzir').onclick=()=>{if(estado.modo!=='auto')lerManual('p');else if(tocando){pararAuto();render();}else tocar();};
$('voltar-questoes').onclick=()=>{estado.fim=false;estado.indice=0;render();};
$('refazer').onclick=()=>{const erros=erradas();if(!erros.length)return;estado.fila=erros;estado.indice=0;estado.fim=false;estado.revisao=true;limpar(erros);render();};
$('refazer-passadas').onclick=()=>{const p=passadas();if(!p.length)return;estado.fila=p;estado.indice=0;estado.fim=false;estado.revisao=true;render();};
function limpar(lista){for(const id of lista){delete estado.respostas[id];delete estado.vf[id];delete estado.reveladas[id];delete estado.vistas[id];delete estado.auto[id];}}
$('recomecar').onclick=()=>$('reiniciar-dialog').showModal();$('cancelar-reinicio').onclick=()=>$('reiniciar-dialog').close();
$('confirmar-reinicio').onclick=()=>{$('reiniciar-dialog').close();limpar(filtradas());for(const id of filtradas())delete estado.dicas[id];estado.fila=filtradas();estado.indice=0;estado.fim=false;estado.revisao=false;estado.destaque=null;render();};
$('configurar').onclick=()=>$('config-dialog').showModal();$('config-fechar').onclick=()=>$('config-dialog').close();
$('mostrar-fonte').onchange=()=>{estado.fonte=$('mostrar-fonte').checked;aplicarFonte();salvar();};
function refiltrar(){pararAuto();fase=0;estado.fila=filtradas();estado.indice=0;estado.fim=false;estado.revisao=false;estado.destaque=null;render();}
for(const t of [...new Set(perguntas.map(q=>meta[q.id].tema))]){const o=el('option',t);o.value=t;$('tema-filtro').append(o);}
$('nivel-filtro').onchange=()=>{const antes=estado.nivel;estado.nivel=$('nivel-filtro').value;if(!filtradas().length){estado.nivel=antes;$('nivel-filtro').value=antes;avisar('Não há questões nesse nível dentro deste tema.');return;}refiltrar();};
$('tema-filtro').onchange=()=>{const antes=estado.tema;estado.tema=$('tema-filtro').value;if(!filtradas().length){estado.tema=antes;$('tema-filtro').value=antes;avisar('Não há questões desse tema neste nível.');return;}refiltrar();};
$('modo').onchange=()=>{pararAuto();fase=0;estado.modo=$('modo').value;render();};
$('ritmo').onchange=()=>{estado.ritmo=$('ritmo').value;salvar();};
$('embaralhar').onclick=()=>{pararAuto();fase=0;const f=estado.fila;for(let i=f.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[f[i],f[j]]=[f[j],f[i]];}estado.indice=0;estado.fim=false;render();avisar('Questões embaralhadas.');};
$('ordem-tema').onclick=()=>{refiltrar();avisar('Questões de volta à ordem do material.');};
$('so-erradas').onclick=()=>{pararAuto();fase=0;const e=filtradas().filter(id=>situacao(id)==='errada');if(!e.length){avisar('Ainda não há questões erradas neste filtro.');return;}limpar(e);estado.fila=e;estado.indice=0;estado.fim=false;estado.revisao=true;render();$('config-dialog').close();};
aplicarFonte();render();if(aviso)avisar(aviso);
})();
