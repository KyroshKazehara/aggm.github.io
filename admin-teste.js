(() => {
  'use strict';
  const API = 'https://agmm-comunidade.lukee-vstone.workers.dev';
  const $ = id => document.getElementById(id);
  const defaults = {homeTitle:'',homeDescription:'',noticeTitle:'',noticeBody:'',interfaceHtml:'',socialLinks:{},socialStats:{},versions:{}};
  let userToken = '', adminToken = '', baseline = null, draft = null, baseSha = null, canPublish = false;

  function status(id, text, error = false) {
    const el = $(id); if (!el) return;
    el.textContent = text || ''; el.dataset.error = String(error);
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  async function request(path, {method='GET', data, token=''} = {}) {
    const headers = {Accept:'application/json'};
    if (token) headers.Authorization = `Bearer ${token}`;
    const options = {method,headers,cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)};
    if (data !== undefined) { headers['Content-Type']='application/json'; options.body=JSON.stringify(data); }
    let response;
    try { response=await fetch(API+path,options); }
    catch { throw new Error('Não foi possível conectar ao Worker AGMM. Confira a conexão e o CORS do domínio.'); }
    let result;
    try { result=await response.json(); } catch { throw new Error(`O serviço respondeu com HTTP ${response.status}, sem JSON válido.`); }
    if (!response.ok) throw new Error(`${result.error || 'Falha no serviço.'} (HTTP ${response.status} · ${path})`);
    return result;
  }

  let previewReady=false, previewTimer, pagesTimer, expectedPublishedSite=null;
  const publicSettingsURL=new URL('./site-settings.json',location.href);
  function previewSettings(site){
    if(previewReady&&site)$('private-preview-frame').contentWindow.postMessage({type:'agmm-private-settings',site},'*');
  }
  async function checkPages(automatic=false,attempt=0){
    clearTimeout(pagesTimer);
    status('pages-status','Conferindo o arquivo servido pelo GitHub Pages…');
    try{
      const url=new URL(publicSettingsURL);url.searchParams.set('check',Date.now());
      const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error('O arquivo ainda não chegou ao Pages (HTTP '+response.status+').');
      const site=await response.json();
      if(expectedPublishedSite&&JSON.stringify(site)!==JSON.stringify(expectedPublishedSite))throw new Error('O Pages ainda está servindo a revisão anterior.');
      previewSettings(site);
      status('pages-status','GitHub Pages atualizado'+(expectedPublishedSite?' com seu teste':'')+'. A prévia abaixo recebeu os dados publicados. A página inicial segue em manutenção.');
      return true;
    }catch(error){
      status('pages-status',error.message+(automatic&&attempt<11?' Vou conferir novamente em 10 segundos.':' Use “Conferir atualização” para tentar novamente.'),true);
      if(automatic&&attempt<11)pagesTimer=setTimeout(()=>checkPages(true,attempt+1),10000);
      return false;
    }
  }
  function openPrivatePreview(){
    clearTimeout(previewTimer);previewReady=false;
    $('private-preview').hidden=false;
    status('private-preview-status','Validando sua conta no servidor e abrindo a interface privada…');
    const form=document.createElement('form');form.method='POST';form.action=API+'/api/creator/preview';form.target='agmm-private-preview';form.hidden=true;
    const input=document.createElement('input');input.type='hidden';input.name='token';input.value=userToken;form.append(input);document.body.append(form);form.submit();form.remove();
    previewTimer=setTimeout(()=>status('private-preview-status','A prévia não confirmou o carregamento. Reabra a prévia; se a sessão expirou, entre novamente na sua conta.',true),20000);
    $('private-preview').scrollIntoView({behavior:'smooth',block:'start'});
  }
  window.addEventListener('message',event=>{
    if(event.source!==$('private-preview-frame').contentWindow||event.data?.type!=='agmm-private-ready')return;
    clearTimeout(previewTimer);previewReady=true;
    status('private-preview-status','Conta oficial validada no servidor. Prévia privada aberta · Site 1.5.');
    if(baseline)previewSettings(baseline);else checkPages();
  });
  $('preview-reopen').addEventListener('click',openPrivatePreview);
  $('preview-edit').addEventListener('click',()=>($( 'admin-panel').hidden?$('admin-step'):$('admin-panel')).scrollIntoView({behavior:'smooth',block:'start'}));
  $('check-pages').addEventListener('click',()=>checkPages());

  function section(name) {
    document.querySelectorAll('[data-panel]').forEach(el => { el.hidden = el.dataset.panel !== name; });
    document.querySelectorAll('[data-section]').forEach(el => el.setAttribute('aria-pressed',String(el.dataset.section===name)));
    if (name==='letters') loadLetters();
    if (name==='history') loadHistory();
  }
  document.querySelectorAll('[data-section]').forEach(button=>button.addEventListener('click',()=>section(button.dataset.section)));

  function updateDraftState() {
    const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
    $('draft-state').textContent = dirty ? 'Alterações pendentes' : 'Sem alterações';
    $('publish-button').disabled = !dirty || !canPublish;
    $('draft-json').textContent = JSON.stringify(draft,null,2);
    $('panel-status').textContent = dirty ? 'Rascunho local: revise as mudanças antes de publicar.' : '';
    $('panel-status').dataset.error = 'false';
  }
  function renderMetrics() {
    const values=[['GitHub',canPublish?'Conectado':'Não autorizado'],['PC Release',draft.versions['pc-release']?.version||'—'],['Android Release',draft.versions['android-release']?.version||'—']];
    const holder=$('metrics'); holder.replaceChildren();
    for(const [label,value] of values){const card=document.createElement('article');card.className='metric';const small=document.createElement('span');small.textContent=label;const strong=document.createElement('strong');strong.textContent=value;card.append(small,strong);holder.append(card);}
  }
  function showLinkStatus() { renderMetrics(); updateDraftState(); }
  async function loadSite() {
    status('connection-status','Buscando configurações protegidas no GitHub…');
    $('reload-site').disabled=true;
    try {
      const result=await request('/api/admin/site',{token:adminToken});
      baseline=clone({...defaults,...result.site,versions:result.site?.versions||{},socialLinks:result.site?.socialLinks||{},socialStats:result.site?.socialStats||{}});
      draft=clone(baseline);baseSha=result.baseSha??null;canPublish=result.canPublish===true;
      $('publish-target').textContent=`Destino fixo: ${result.repository}/${result.path} · branch ${result.branch}`;
      $('base-sha').textContent=baseSha?baseSha.slice(0,12):'Arquivo será criado';
      status('connection-status',canPublish?'GitHub conectado; o Worker aceita publicação. O segredo não foi enviado ao navegador.':'Configurações carregadas, mas o Worker informou que a publicação ainda não está pronta.',!canPublish);
      fillForms();showLinkStatus();previewSettings(baseline);return true;
    } catch(error) { status('connection-status',error.message,true);canPublish=false;$('publish-button').disabled=true;return false; }
    finally {$('reload-site').disabled=false;}
  }
  function fillForms() {
    const stats=$('stats-form');stats.elements.youtubeSubscribers.value=draft.socialStats.youtubeSubscribers||'';stats.elements.discordMembers.value=draft.socialStats.discordMembers||'';for(const key of ['tiktokFollowers','twitchGoalCurrent','twitchGoalTarget','youtubeGoalCurrent','youtubeGoalTarget'])stats.elements[key].value=draft.socialStats[key]??({twitchGoalCurrent:'0',twitchGoalTarget:'50',youtubeGoalCurrent:'0',youtubeGoalTarget:'3000'}[key]||'');
    const links=$('links-form');for(const key of ['discord1','discord2','youtube','twitch','twitter','tiktok'])links.elements[key].value=draft.socialLinks[key]||'';
    const content=$('content-form');for(const key of ['homeTitle','homeDescription','noticeTitle','noticeBody','interfaceHtml'])content.elements[key].value=draft[key]||'';
    fillVersion();
  }
  function fillVersion() {
    const item=draft.versions[$('version-channel').value]||{};const form=$('version-form');
    for(const key of ['title','version','url','secondaryUrl','description'])form.elements[key].value=item[key]||'';
  }
  $('version-channel').addEventListener('change',fillVersion);
  // Editing a field immediately updates the draft; publication remains explicit.
  for (const id of ['stats-form','links-form','content-form','version-form']) {
    $(id).addEventListener('input',event=>{
      if(!draft||event.target.id==='version-channel')return;
      const form=event.currentTarget;
      const values=Object.fromEntries(new FormData(form));
      if(id==='stats-form')draft.socialStats={...draft.socialStats,...values};
      if(id==='links-form')draft.socialLinks={...draft.socialLinks,...values};
      if(id==='content-form')Object.assign(draft,values);
      if(id==='version-form'){
        const key=$('version-channel').value;
        draft.versions[key]={...(draft.versions[key]||{})};
        for(const field of ['title','version','url','secondaryUrl','description'])draft.versions[key][field]=form.elements[field].value.trim();
      }
      updateDraftState();renderMetrics();
    });
  }

  $('stats-form').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;draft.socialStats={...draft.socialStats,youtubeSubscribers:f.elements.youtubeSubscribers.value.trim(),discordMembers:f.elements.discordMembers.value.trim(),...Object.fromEntries(['tiktokFollowers','twitchGoalCurrent','twitchGoalTarget','youtubeGoalCurrent','youtubeGoalTarget'].map(key=>[key,f.elements[key].value.trim()]))};updateDraftState();});
  $('links-form').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;draft.socialLinks={...draft.socialLinks};for(const key of ['discord1','discord2','youtube','twitch','twitter','tiktok'])draft.socialLinks[key]=f.elements[key].value.trim();updateDraftState();});
  $('content-form').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;for(const key of ['homeTitle','homeDescription','noticeTitle','noticeBody','interfaceHtml'])draft[key]=f.elements[key].value;updateDraftState();});
  $('version-form').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget,key=$('version-channel').value;draft.versions[key]={...(draft.versions[key]||{})};for(const field of ['title','version','url','secondaryUrl','description'])draft.versions[key][field]=f.elements[field].value.trim();updateDraftState();renderMetrics();});

  async function loadLetters() {
    status('letters-status','Carregando cartinhas…');$('refresh-letters').disabled=true;
    try {
      const result=await request('/api/admin/suggestions',{token:adminToken});const holder=$('suggestions');holder.replaceChildren();const entries=Array.isArray(result.items)?result.items:[];
      if(!entries.length){const empty=document.createElement('p');empty.className='note';empty.textContent='Nenhuma cartinha recebida.';holder.append(empty);}
      for(const item of entries){const card=document.createElement('article');card.className='suggestion';const badges=document.createElement('div');badges.className='badges';for(const value of [item.kind,item.team,item.status])if(value){const badge=document.createElement('span');badge.className='badge';badge.textContent=value;badges.append(badge);}const title=document.createElement('h3');title.textContent=item.title||'Cartinha sem título';const description=document.createElement('p');description.textContent=item.description||'';const author=document.createElement('p');author.textContent=item.author?`De: ${item.author}`:'';card.append(badges,title,description,author);holder.append(card);}
      status('letters-status',`${entries.length} cartinha(s). Esta área de teste está em modo de consulta.`);
    } catch(error){status('letters-status',error.message,true);}
    finally{$('refresh-letters').disabled=false;}
  }
  $('refresh-letters').addEventListener('click',loadLetters);

  async function loadHistory() {
    status('history-status','Buscando commits de site-settings.json…');$('history-list').replaceChildren();
    try {
      const result=await request('/api/admin/site/history',{token:adminToken});const holder=$('history-list');const items=Array.isArray(result.items)?result.items:[];
      if(!items.length){const empty=document.createElement('p');empty.className='note';empty.textContent='Nenhuma publicação anterior de configurações foi encontrada.';holder.append(empty);}
      for(const item of items){const row=document.createElement('article');row.className='history-item';const left=document.createElement('div');left.className='history-left';const title=document.createElement('strong');title.textContent=item.action==='undo-published-site'?'Reversão publicada':'Atualização do site';const detail=document.createElement('small');detail.textContent=`${item.actor_id||'Criador'} · ${new Date(item.created_at).toLocaleString('pt-BR')} · ${(item.id||'').slice(0,10)}`;left.append(title,detail);row.append(left);if(item.url){const link=document.createElement('a');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Ver commit ↗';row.append(link);}holder.append(row);}
      status('history-status',`${items.length} revisão(ões) encontradas.`);
    } catch(error){status('history-status',error.message,true);}
  }

  $('reload-site').addEventListener('click',loadSite);
  $('publish-button').addEventListener('click',async()=>{
    if(!draft||!canPublish||JSON.stringify(draft)===JSON.stringify(baseline))return;
    const ok=confirm('Publicar essas alterações no GitHub? O Worker criará um commit em KyroshKazehara/aggm.github.io, branch main.');if(!ok)return;
    const button=$('publish-button');button.disabled=true;status('panel-status','Enviando rascunho ao Worker e criando commit…');
    try {
      const result=await request('/api/admin/site/publish',{method:'POST',token:adminToken,data:{site:draft,baseSha,confirm:true}});
      baseline=clone(draft);baseSha=result.contentSha||baseSha;updateDraftState();status('panel-status',`Publicado. Commit ${result.commit.slice(0,10)} em ${result.branch}.`);
      if(result.commitUrl){const link=document.createElement('a');link.href=result.commitUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Abrir commit no GitHub ↗';link.className='commit-link';$('panel-status').append(' ',link);}
      expectedPublishedSite=clone(baseline);checkPages(true);loadHistory();
    } catch(error){status('panel-status',error.message,true);button.disabled=false;}
  });
  $('logout-button').addEventListener('click',async()=>{
    try{if(adminToken)await request('/api/admin/logout',{method:'POST',token:adminToken});}catch{}
    try{if(userToken)await request('/api/auth/logout',{method:'POST',token:userToken});}catch{}
    clearTimeout(previewTimer);clearTimeout(pagesTimer);previewReady=false;expectedPublishedSite=null;$('private-preview').hidden=true;$('private-preview-frame').src='about:blank';userToken='';adminToken='';baseline=null;draft=null;canPublish=false;$('admin-panel').hidden=true;$('admin-step').hidden=true;$('account-form').hidden=false;$('account-form').reset();$('admin-form').reset();$('suggestions').replaceChildren();$('history-list').replaceChildren();status('account-status','Sessão encerrada.');
  });
  $('account-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]');button.disabled=true;status('account-status','Conectando à API oficial AGMM…');
    try{const result=await request('/api/auth/login',{method:'POST',data:Object.fromEntries(new FormData(form))});userToken=result.token||'';if(!userToken||!result.user)throw new Error('Resposta de login incompleta.');if(!result.user.isCreator){userToken='';throw new Error('Esta conta não tem acesso de criador.');}$('creator-label').textContent=`Conta oficial confirmada: ${result.user.displayName||result.user.username}. Valide a chave e o Authenticator.`;$('admin-step').hidden=false;form.hidden=true;status('account-status','Conta oficial validada.');openPrivatePreview();}
    catch(error){status('account-status',error.message,true);}
    finally{form.elements.password.value='';button.disabled=false;}
  });
  $('admin-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]');button.disabled=true;status('admin-status','Validando chave do painel e Authenticator…');
    try{const result=await request('/api/admin/login',{method:'POST',data:Object.fromEntries(new FormData(form)),token:userToken});adminToken=result.token||'';if(!adminToken)throw new Error('O serviço não retornou uma sessão administrativa.');if(!await loadSite())throw new Error($('connection-status').textContent||'Não foi possível ler as configurações protegidas do site.');$('admin-step').hidden=true;$('admin-panel').hidden=false;section('overview');}
    catch(error){adminToken='';status('admin-status',error.message,true);}
    finally{form.reset();button.disabled=false;}
  });
})();