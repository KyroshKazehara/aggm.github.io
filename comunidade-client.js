

(() => {
 'use strict';
 const $=id=>document.getElementById(id), config=window.AGMM_SITE||{};
 let configured=false,base='';
 try {if(typeof config.apiBase==='string'&&config.apiBase.trim()){const endpoint=new URL(config.apiBase==='same-origin'?location.origin:config.apiBase);const local=['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname);if((endpoint.protocol!=='https:'&&!(local&&endpoint.protocol==='http:'))||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!['','/'].includes(endpoint.pathname))throw new Error('Endereço da API inválido.');base=endpoint.origin;configured=true;}}catch{}
 let creationsUpdateId='';
 function creationsBadge(id){
  if(id)creationsUpdateId=id;if(!creationsUpdateId)return;
  let seen='';try{seen=localStorage.getItem('agmm-creations-seen-update')||'';}catch{}
  const opened=location.hash==='#creations';
  if(!seen||opened){seen=creationsUpdateId;try{localStorage.setItem('agmm-creations-seen-update',seen);}catch{}}
  const unread=seen!==creationsUpdateId;const button=document.querySelector('[data-page="creations"]');$('creations-update-dot').hidden=!unread;button.setAttribute('aria-label',unread?'Criações do AGMM — novidades disponíveis':'Criações do AGMM');
 }
 function notifyAdminSession(active) {
  window.dispatchEvent(new CustomEvent('agmm:admin-session', {detail: {active}}));
 }
 let sessionToken='',user=null,adminToken='',catalog=[],filter='todos',originalsOnly=false,editingSuggestionId='';
 // Remove old preview tokens. Real sessions remain only in this page's memory.
 try {sessionStorage.removeItem('agmm-session');}catch{}
 const status=(id,message,bad=false)=>{const el=$(id);if(!el)return;el.textContent=message;el.dataset.error=String(bad);};
 const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
 const date=value=>new Date(value).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
 const statusName={'nova':'Recebida','em analise':'Em análise','aceita':'Aceita','arquivada':'Arquivada','excluida':'Excluída'};
 const asset=path=>base+(config.apiPrefix||'')+path;
 async function api(path,{method='GET',data,body,admin=false,signal}={}) {
  window.dispatchEvent(new Event('agmm:load-start'));try{
  if(!configured)throw new Error('O servidor de contas e sugestões ainda não foi ativado. Os downloads continuam disponíveis sem login.');
  const headers={};const key=admin?adminToken:sessionToken;if(key)headers.Authorization=`Bearer ${key}`;
  if(data!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(data);}
  const response=await fetch(base+(config.apiPrefix||'')+path,{method,headers,body,signal:signal||AbortSignal.timeout(20000),cache:'no-store',credentials:admin?'omit':'include',redirect:'error',referrerPolicy:'no-referrer'});
  let result;try{result=await response.json();}catch{throw new Error('O servidor não respondeu corretamente. Tente novamente mais tarde.');}
  if(!response.ok){if(admin&&response.status===401&&adminToken){adminToken='';$('admin-area').hidden=true;$('admin-login').hidden=false;notifyAdminSession(false);}const error=new Error((result.error||'Não foi possível concluir.')+' (HTTP '+response.status+' · '+path+')');error.code=response.status;throw error;}
  return result;
  }finally{window.dispatchEvent(new Event('agmm:load-end'));}
 }
 function page(name,focus=true) {
  const valid=['home','functions','creations','suggestions','account','admin','updates','coins'];if(!valid.includes(name))name='home';if(name==='admin'&&!config.preview&&!user?.isCreator)name='account';
  originalsOnly=name==='creations';const displayPage=originalsOnly?'functions':name;
  $('home-page').hidden=name!=='home';document.querySelectorAll('.community-page').forEach(el=>el.hidden=el.id!==`page-${displayPage}`);
  document.querySelectorAll('[data-page]').forEach(el=>{el.classList.toggle('active',el.dataset.page===name);if(el.dataset.page===name)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  document.querySelector('.site-nav').dispatchEvent(new Event('navselection'));
  if(location.hash!==`#${name}`)history.replaceState(null,'',`#${name}`);
  if(focus){window.scrollTo({top:0,behavior:'instant'});const title=$(`page-${name}`)?.querySelector('h1');if(title){title.tabIndex=-1;title.focus({preventScroll:true});}}
  if(name==='suggestions'){loadAccepted();if(user)loadMine();}if(name==='account'&&user)loadNotificationHistory();if(name==='creations')creationsBadge();
  if(name==='functions'||originalsOnly){const title=$('page-functions').querySelector('h1');title.textContent=originalsOnly?'Criações do AGMM':'Funções e Modos';renderCatalog();}
 }
 document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>page(el.dataset.page)));
 window.addEventListener('hashchange',()=>page(location.hash.slice(1),false));
 function badges(entry){const row=node('div',undefined,'entry-badges');const kind=node('span',entry.kind==='modo'?'Modo de jogo':entry.kind==='carta'?'Carta':entry.kind==='funcao'?'Função':'Outros','entry-badge');row.append(kind);if(entry.preview)row.append(node('span','Novo · Prévia','entry-badge agmm-new-pill'));if(entry.kind!=='modo'){const team=node('span',entry.team,'entry-badge');team.dataset.team=entry.team;row.append(team);}return row;}
 function renderCatalog(){
  // The seven earlier previews stay visible; ten new roles are masked separately.
  const search=normalize($('catalog-search').value);const items=catalog.filter(e=>(!originalsOnly||e.agmmOriginal)&&(filter==='todos'||filter===e.kind)&&normalize(`${e.title} ${e.description} ${e.team}`).includes(search));
  $('catalog-grid').replaceChildren();status('catalog-count',`${items.length} ${items.length===1?'criação encontrada':'criações encontradas'}`);
  for(const entry of items){const card=node('article',undefined,'catalog-card');card.append(badges(entry),node('h2',entry.title),node('p',entry.description));$('catalog-grid').append(card);}
  if(!items.length)$('catalog-grid').append(node('p','Nenhuma criação encontrada. Tente outra busca.','empty-state'));
  renderAdminCatalog();
 }
 async function loadCatalog(){
  try {const result=configured?await api('/api/catalog'):JSON.parse($('agmm-initial-catalog').textContent);const initial=JSON.parse($('agmm-initial-catalog').textContent).items;const live=result.items||[];catalog=[...live.map(e=>({...e,preview:initial.some(x=>(x.id===e.id||x.title===e.title)&&x.preview),agmmOriginal:initial.some(x=>(x.id===e.id||x.title===e.title)&&x.agmmOriginal)})),...initial.filter(e=>!live.some(x=>x.id===e.id||x.title===e.title))];renderCatalog();}
  catch{catalog=JSON.parse($('agmm-initial-catalog').textContent).items;renderCatalog();}
 }
 $('catalog-search').addEventListener('input',renderCatalog);
 document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(el=>{el.classList.toggle('active',el===button);el.setAttribute('aria-pressed',String(el===button));});renderCatalog();}));
 function authMode(mode){document.querySelectorAll('[data-auth]').forEach(el=>{el.classList.toggle('active',el.dataset.auth===mode);el.setAttribute('aria-pressed',String(el.dataset.auth===mode));});$('login-form').hidden=mode!=='login';$('register-form').hidden=mode!=='register';}
 document.querySelectorAll('[data-auth]').forEach(el=>el.addEventListener('click',()=>authMode(el.dataset.auth)));
 function setSession(value){sessionToken=value;}
 function renderUser(){
  $('auth-area').hidden=!!user;$('profile-area').hidden=!user;$('my-suggestions').hidden=!user;
  $('creator-nav').hidden=!user?.isCreator;if(!user?.isCreator){adminToken='';notifyAdminSession(false);$('admin-area').hidden=true;$('admin-login').hidden=false;}document.querySelectorAll('.creator-panel-link[data-page=admin]').forEach(el=>el.hidden=!user?.isCreator);window.dispatchEvent(new CustomEvent('agmm:user-change',{detail:{isCreator:!!user?.isCreator}}));document.querySelector('.site-nav').dispatchEvent(new Event('navselection'));
  $('account-label').textContent=user?user.displayName:'Entrar';
  const navAvatar=$('nav-avatar');navAvatar.hidden=!user?.avatar;
  if(user?.avatar)navAvatar.src=asset(user.avatar);else navAvatar.removeAttribute('src');
  $('suggestion-account').replaceChildren();
  if(user){
   $('suggestion-account').textContent=`Enviando como ${user.displayName} (@${user.username}).`;
   $('profile-name').textContent=user.displayName;$('profile-username').textContent=`@${user.username}`;
   $('profile-form').elements.displayName.value=user.displayName;
   $('avatar-fallback').textContent=user.displayName.slice(0,1).toUpperCase();
   $('avatar-fallback').hidden=!!user.avatar;$('profile-avatar').hidden=!user.avatar;
   if(user.avatar)$('profile-avatar').src=asset(user.avatar);else $('profile-avatar').removeAttribute('src');
  }else{
   if(editingSuggestionId)clearSuggestionEdit();
   $('suggestion-account').append(document.createTextNode('Para enviar uma cartinha, '));const link=node('button','entre ou crie sua conta','inline-login');link.type='button';link.addEventListener('click',()=>page('account'));$('suggestion-account').append(link,document.createTextNode('. Os downloads não exigem login.'));
   $('my-suggestions-list').replaceChildren();linkedPushAccount='';pendingSuggestionAlerts=[];$('suggestion-alert').hidden=true;
  }
  if(user){linkAccountPush();checkSuggestionAlerts();loadNotificationHistory();}else $('notification-history').replaceChildren();
 }
 async function submit(form,message,action){
  const button=form.querySelector('button[type=submit],button:not([type])');if(button)button.disabled=true;status(message,'Aguarde…');
  try{await action();}catch(e){status(message,e.message,true);}finally{if(button)button.disabled=false;}
 }

 let alertTimer,linkedPushAccount='',linkingPush=false,checkingSuggestionAlerts=false,pendingSuggestionAlerts=[];const shownSuggestionAlerts=new Set();
 async function pushDeviceData(){if(!pushSupported())return {};const registration=await navigator.serviceWorker.getRegistration(new URL('./',location.href).href);const subscription=await registration?.pushManager.getSubscription();const manageToken=localStorage.getItem('agmm-push-device-token');return subscription&&manageToken?{endpoint:subscription.endpoint,manageToken}:{};}
 async function linkAccountPush(){if(!user||linkingPush||linkedPushAccount===user.id)return;linkingPush=true;const owner=user.id;try{const data=await pushDeviceData();if(data.endpoint){await api('/api/push/link',{method:'POST',data});if(user?.id===owner)linkedPushAccount=owner;}}catch{}finally{linkingPush=false;}}
 function suggestionNotice(item){return item.status==='aceita'?'🎉 Sua cartinha “'+item.title+'” foi aceita! Veja em Criações AGMM e em Sugestão de Função.':'Sua cartinha “'+item.title+'” está '+(statusName[item.status]||item.status).toLowerCase()+'.';}
 async function checkSuggestionAlerts(){if(!user||checkingSuggestionAlerts)return;const owner=user.id;checkingSuggestionAlerts=true;try{const result=await api('/api/notifications');if(user?.id!==owner)return;pendingSuggestionAlerts=result.items.filter(item=>!item.read_at);const fresh=pendingSuggestionAlerts.filter(item=>!shownSuggestionAlerts.has(item.id));if(fresh.length){for(const item of fresh)shownSuggestionAlerts.add(item.id);const latest=fresh[0];$('suggestion-alert-message').textContent=suggestionNotice(latest)+(latest.reason?' Motivo: '+latest.reason:'')+(fresh.length>1?' Você tem '+fresh.length+' atualizações para conferir.':'');$('suggestion-alert').hidden=false;clearTimeout(alertTimer);alertTimer=setTimeout(()=>$('suggestion-alert').hidden=true,12000);if(location.hash==='#suggestions')loadMine();}const url=new URL(location.href);if(url.searchParams.has('suggestion-alert')){url.searchParams.delete('suggestion-alert');history.replaceState(null,'',url.href);}}catch{}finally{checkingSuggestionAlerts=false;}}
 async function acknowledgeSuggestionAlerts(open){clearTimeout(alertTimer);$('suggestion-alert').hidden=true;const ids=pendingSuggestionAlerts.map(item=>item.id);pendingSuggestionAlerts=[];if(!user)return;if(open)page('suggestions');try{await api('/api/notifications/read',{method:'POST',data:{ids}});}catch{/* Dismissing a local notice must never become an authentication error popup. */}}
 $('suggestion-alert-open').addEventListener('click',()=>acknowledgeSuggestionAlerts(true));$('suggestion-alert-close').addEventListener('click',()=>acknowledgeSuggestionAlerts(false));setInterval(()=>{if(!document.hidden)checkSuggestionAlerts();},30000);window.addEventListener('focus',()=>{linkAccountPush();checkSuggestionAlerts();});
 $('login-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;submit(form,'login-status',async()=>{const data=Object.fromEntries(new FormData(form));const result=await api('/api/auth/login',{method:'POST',data});setSession(result.token);user=result.user;form.reset();status('login-status','');renderUser();});});
 $('register-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;submit(form,'register-status',async()=>{const data=Object.fromEntries(new FormData(form));if(data.password!==data.confirmation)throw new Error('As senhas precisam ser iguais.');delete data.confirmation;const result=await api('/api/auth/register',{method:'POST',data});setSession(result.token);user=result.user;form.reset();status('register-status','');renderUser();});});
 $('logout-button').addEventListener('click',async()=>{try{if(adminToken){await api('/api/admin/logout',{method:'POST',admin:true});adminToken='';}await api('/api/auth/logout',{method:'POST',data:await pushDeviceData()});setSession('');user=null;adminToken='';$('admin-area').hidden=true;$('admin-login').hidden=false;renderUser();}catch(error){status('profile-status',error.message,true);}});
 $('profile-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;submit(form,'profile-status',async()=>{const result=await api('/api/me',{method:'PATCH',data:Object.fromEntries(new FormData(form))});user=result.user;renderUser();status('profile-status','Seu nome foi atualizado.');});});
 async function resizeAvatar(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Escolha uma imagem PNG, JPEG ou WebP de até 5 MB.');
  const picture=await createImageBitmap(file);try{if(picture.width>12000||picture.height>12000)throw new Error('A imagem é grande demais. Escolha uma foto menor.');const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const context=canvas.getContext('2d');const side=Math.min(picture.width,picture.height);context.drawImage(picture,(picture.width-side)/2,(picture.height-side)/2,side,side,0,0,256,256);const compressed=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Não foi possível preparar a imagem.')),'image/webp',.78));if(compressed.size>500*1024)throw new Error('A foto precisa ficar abaixo de 500 KB.');return compressed;}finally{picture.close();}
 }
 $('avatar-file').addEventListener('change',async event=>{const input=event.currentTarget,file=input.files[0];if(!file)return;input.disabled=true;status('avatar-status','Preparando sua foto…');try{const photo=await resizeAvatar(file);const result=await api('/api/me/avatar',{method:'PUT',body:photo});user=result.user;renderUser();status('avatar-status','Foto de perfil atualizada.');}catch(e){status('avatar-status',e.message,true);}finally{input.value='';input.disabled=false;}});
 const suggestionForm=$('suggestion-form'),suggestionSubmit=suggestionForm.querySelector('button[type="submit"]'),cancelSuggestionEdit=node('button','Cancelar edição','community-secondary');cancelSuggestionEdit.type='button';cancelSuggestionEdit.hidden=true;suggestionSubmit.before(cancelSuggestionEdit);
 function clearSuggestionEdit(){editingSuggestionId='';suggestionForm.reset();suggestionSubmit.replaceChildren(document.createTextNode('Enviar minha ideia '),node('span','↗'));cancelSuggestionEdit.hidden=true;}
 function startSuggestionEdit(entry){if(entry.status!=='nova')return;editingSuggestionId=entry.id;suggestionForm.elements.title.value=entry.title;suggestionForm.elements.kind.value=entry.kind;suggestionForm.elements.team.value=entry.team;suggestionForm.elements.description.value=entry.description;suggestionSubmit.textContent='Salvar alterações da cartinha';cancelSuggestionEdit.hidden=false;status('suggestion-status','Editando sua cartinha. Você pode alterar enquanto ela estiver como Recebida.');suggestionForm.scrollIntoView({behavior:'smooth',block:'center'});suggestionForm.elements.title.focus();}
 cancelSuggestionEdit.addEventListener('click',()=>{clearSuggestionEdit();status('suggestion-status','Edição cancelada.');});
 $('suggestion-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;submit(form,'suggestion-status',async()=>{if(!user)throw new Error('Entre na sua conta para enviar. Seu texto continua aqui.');const data=Object.fromEntries(new FormData(form));delete data.website;if(editingSuggestionId){const id=editingSuggestionId;await api('/api/suggestions/'+encodeURIComponent(id),{method:'PATCH',data});clearSuggestionEdit();status('suggestion-status','Sua cartinha foi atualizada.');}else{const result=await api('/api/suggestions',{method:'POST',data});clearSuggestionEdit();status('suggestion-status',`Cartinha recebida! Protocolo ${result.id.slice(0,8)}. Você pode acompanhar abaixo. OBS.: Enviar uma sugestão não garante que sua função será adicionada ao mod. Pedimos, por gentileza e empatia, que não enviem mensagens na DM perguntando se ela já foi incluída. Você pode acompanhar o status da sua sugestão nas suas cartinhas.`);}await loadMine();});});
 function letter(entry,privatePanel=false,ownPanel=false){
  const card=node('article',undefined,'suggestion-item letter-card');card.dataset.kind=entry.kind||'outros';card.dataset.status=entry.status||'nova';const top=node('div',undefined,'letter-top');const symbols={funcao:'♟',carta:'♦',modo:'✦',outros:'✉'};const identity=node('span',undefined,'letter-identity');identity.append(node('span',symbols[entry.kind]||symbols.outros,'letter-emblem'),node('span','CARTINHA DA COMUNIDADE','letter-label'));top.append(identity,node('span',date(entry.created_at),'letter-date'));
  card.append(top,badges(entry),node('h3',entry.title),node('p',entry.description,'idea-body'));
  const bottom=node('div',undefined,'letter-bottom');bottom.append(node('span',`De: ${entry.author}`,'letter-author'));
  if(privatePanel){bottom.append(node('span',statusName[entry.status]||entry.status,'letter-stamp'));const select=document.createElement('select');select.setAttribute('aria-label',`Status de ${entry.title}`);for(const [value,label]of Object.entries(statusName)){if(!config.preview&&!config.moderationV2&&value==='excluida')continue;const option=node('option',label);option.value=value;option.selected=entry.status===value;select.append(option);}select.addEventListener('change',async()=>{const chosen=select.value;select.value=entry.status;if((config.preview||config.moderationV2)&&['excluida','arquivada'].includes(chosen)){review(entry,chosen);return;}select.disabled=true;try{await moderate(entry,chosen);}catch(e){status('admin-status',e.message,true);}finally{select.disabled=false;}});bottom.append(select);}else bottom.append(node('span',statusName[entry.status]||entry.status,'letter-stamp'));
  if(ownPanel&&entry.status==='nova'){const edit=node('button','Editar cartinha','community-secondary');edit.type='button';edit.addEventListener('click',()=>startSuggestionEdit(entry));bottom.append(edit);}
  card.append(bottom);if(entry.review_reason)card.append(node('p','Motivo: '+entry.review_reason,'review-reason'));
 if(Array.isArray(entry.history)&&entry.history.length){const details=node('details');details.append(node('summary','Histórico da cartinha'));for(const h of entry.history)details.append(node('p',(statusName[h.to]||h.to)+' · '+date(h.at)+(h.reason?' · '+h.reason:'')));card.append(details);}return card;
 }
 async function loadMine(){if(!user)return;try{const result=await api('/api/suggestions');$('my-suggestions-list').replaceChildren(...result.items.map(e=>letter(e,false,true)));if(!result.items.length)$('my-suggestions-list').append(node('p','Sua primeira cartinha pode começar aqui.','empty-state'));}catch(e){$('my-suggestions-list').replaceChildren(node('p',e.message,'empty-state'));}}
 $('my-refresh').addEventListener('click',loadMine);
 let inboxItems=[],inboxFilter='nova',inboxKind='funcao';
 function belongs(entry){return inboxKind==='outros'?!['funcao','carta','modo'].includes(entry.kind):entry.kind===inboxKind;}
 function inboxMatches(entry,tab){return belongs(entry)&&entry.status===tab;}
 function renderInbox(){const items=inboxItems.filter(e=>inboxMatches(e,inboxFilter));$('suggestions-list').replaceChildren(...items.map(e=>letter(e,true)));if(!items.length)$('suggestions-list').append(node('p','Nenhuma cartinha neste estado e tipo.','empty-state'));const labels={nova:'Recebidas','em analise':'Em análise',aceita:'Aceitas',excluida:'Excluídas',arquivada:'Arquivadas'};document.querySelectorAll('[data-inbox]').forEach(b=>{const tab=b.dataset.inbox,count=inboxItems.filter(e=>inboxMatches(e,tab)).length;b.textContent=labels[tab]+' ('+count+')';b.classList.toggle('active',tab===inboxFilter);b.setAttribute('aria-pressed',String(tab===inboxFilter));});document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===inboxKind)));}
 document.querySelectorAll('[data-inbox]').forEach(b=>b.addEventListener('click',()=>{inboxFilter=b.dataset.inbox;renderInbox();}));
 document.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>{inboxKind=b.dataset.kind;inboxFilter='nova';renderInbox();}));
 async function loadInbox(){const result=await api('/api/admin/suggestions',{admin:true});inboxItems=result.items;renderInbox();status('admin-status',`${result.items.length} sugestões recebidas.`);}
 async function loadAccepted(){try{const result=await api('/api/suggestions/accepted');$('accepted-suggestions').replaceChildren(...result.items.map(e=>letter(e)));if(!result.items.length)$('accepted-suggestions').append(node('p','Ainda não há cartinhas aceitas.','empty-state'));}catch{$('accepted-suggestions').replaceChildren(node('p','Não foi possível carregar as sugestões aceitas.','empty-state'));}}
 async function loadNotificationHistory(){if(!user)return;const owner=user.id;try{const result=await api('/api/notifications');if(user?.id!==owner)return;$('notification-history').replaceChildren(...result.items.map(e=>{const item=node('article',undefined,'suggestion-item');item.append(node('strong',e.title),node('p',suggestionNotice(e)+' · '+date(e.created_at)+(e.reason?' · Motivo: '+e.reason:'')));const button=node('button','Ver minhas cartinhas','community-secondary');button.type='button';button.addEventListener('click',()=>page('suggestions'));item.append(button);return item;}));if(!result.items.length)$('notification-history').append(node('p','Você ainda não recebeu notificações.','muted'));}catch(e){$('notification-history').replaceChildren(node('p',e.message,'muted'));}}
 $('notifications-refresh').addEventListener('click',loadNotificationHistory);
 $('admin-login').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;submit(form,'admin-login-status',async()=>{if(!user?.isCreator)throw new Error('Entre primeiro na conta oficial do criador.');const key=form.elements.key.value,code=form.elements.code.value;form.elements.key.value='';form.elements.code.value='';let result;try{result=await api('/api/admin/login',{method:'POST',data:{key,code}});}catch(e){if(e.code===401)throw new Error('O servidor recusou a chave do painel ou o código. Confira a chave e use um código novo do Authenticator.');throw e;}if(!result.token)throw new Error('O servidor não retornou uma sessão administrativa.');adminToken=result.token;try{await loadInbox();}catch(e){if(!adminToken)throw new Error('A sessão administrativa expirou. Entre novamente no painel.');status('admin-status','Sessão iniciada, mas não foi possível carregar as cartinhas. Clique em Atualizar. '+e.message,true);}$('admin-login').hidden=true;$('admin-area').hidden=false;form.reset();status('admin-login-status','');renderAdminCatalog();notifyAdminSession(true);});});
 $('admin-refresh').addEventListener('click',()=>loadInbox().catch(e=>status('admin-status',e.message,true)));
 $('admin-logout').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST',admin:true});}catch{}adminToken='';$('admin-login').hidden=false;$('admin-area').hidden=true;notifyAdminSession(false);$('suggestions-list').replaceChildren();$('admin-catalog').replaceChildren();$('catalog-form').reset();});
 function renderAdminCatalog(){if(!adminToken)return;const holder=$('admin-catalog');holder.replaceChildren();for(const entry of catalog.filter(e=>($('admin-catalog-kind').value==='todos'||e.kind===$('admin-catalog-kind').value)&&normalize(e.title+' '+e.description).includes(normalize($('admin-catalog-search').value)))){const row=node('article',undefined,'suggestion-item');row.append(badges(entry),node('h3',entry.title),node('p',entry.description,'idea-body'));const actions=node('div',undefined,'admin-actions');const edit=node('button','Editar','community-secondary');edit.type='button';edit.addEventListener('click',()=>{const form=$('catalog-form');for(const key of ['id','title','kind','team','description'])form.elements[key].value=entry[key];$('catalog-save').textContent='Salvar alterações';form.scrollIntoView({behavior:'smooth',block:'center'});});const remove=node('button','Excluir','community-secondary');remove.type='button';remove.addEventListener('click',async()=>{if(!confirm(config.preview?`Ocultar “${entry.title}” nesta cópia de teste? O item original será preservado.`:`Excluir permanentemente “${entry.title}” do catálogo oficial? Esta operação não pode ser desfeita.`))return;remove.disabled=true;try{await api(`/api/admin/catalog/${entry.id}`,{method:'DELETE',admin:true});await loadCatalog();status('catalog-status',config.preview?'Item ocultado somente na cópia de teste; o original foi preservado.':'Item removido do catálogo oficial.');}catch(e){status('catalog-status',e.message,true);remove.disabled=false;}});actions.append(edit,remove);row.append(actions);holder.append(row);}}
 $('catalog-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;submit(form,'catalog-status',async()=>{const data=Object.fromEntries(new FormData(form)),id=data.id;delete data.id;await api('/api/admin/catalog'+(id?`/${id}`:''),{method:id?'PATCH':'POST',data,admin:true});form.reset();$('catalog-save').textContent='Publicar no catálogo';status('catalog-status','Catálogo atualizado para os visitantes.');await loadCatalog();});});
 $('admin-catalog-search').addEventListener('input',renderAdminCatalog);$('admin-catalog-kind').addEventListener('change',renderAdminCatalog);
 $('catalog-cancel').addEventListener('click',()=>{$('catalog-form').reset();$('catalog-save').textContent='Publicar no catálogo';status('catalog-status','');});

 window.AGMMPreviewAdmin=Object.freeze({request:(path,options={})=>api(path,{...options,admin:true})});
 document.querySelectorAll('[data-demo-role]').forEach(button=>button.addEventListener('click',async()=>{try{
  if(!config.preview)throw new Error('Contas de demonstração não estão disponíveis na versão final.');const result=await api('/api/preview/session',{method:'POST',data:{role:button.dataset.demoRole}});
  pendingSuggestionAlerts=[];shownSuggestionAlerts.clear();$('suggestion-alert').hidden=true;$('my-suggestions-list').replaceChildren();
  sessionToken=result.token||'';adminToken=result.adminToken||'';user=result.user||null;renderUser();
  $('admin-login').hidden=!!adminToken;$('admin-area').hidden=!adminToken;
  if(adminToken){await loadInbox();renderAdminCatalog();}else{$('suggestions-list').replaceChildren();$('admin-catalog').replaceChildren();}
  $('preview-tools-dialog').close();page(adminToken?'admin':user?'suggestions':'home');window.dispatchEvent(new CustomEvent('agmm:demo-session',{detail:{role:button.dataset.demoRole}}));
 }catch(e){status('preview-toast',e.message,true);$('preview-toast').hidden=false;}}));
 let pendingReview=null;
 function review(entry,newStatus){pendingReview={entry,newStatus};$('review-title').textContent=(newStatus==='excluida'?'Excluir':newStatus==='arquivada'?'Arquivar':'Revisar')+' “'+entry.title+'”';$('review-reason').value='';$('review-feedback').textContent='';$('review-dialog').showModal();$('review-reason').focus();}
 async function moderate(entry,newStatus,reason=''){
  const result=await api(`/api/admin/suggestions/${entry.id}`,{method:'PATCH',admin:true,data:{status:newStatus,reason}});
  Object.assign(entry,result.item||{status:newStatus,...((config.preview||config.moderationV2)?{review_reason:reason}:{})});renderInbox();loadAccepted();status('admin-status',config.preview?'Cartinha de teste atualizada. Histórico e aviso da pessoa autora preservados.':'Status atualizado no serviço oficial.');
 }
 $('review-form').addEventListener('submit',async event=>{event.preventDefault();if(!pendingReview)return;const button=event.currentTarget.querySelector('button[type=submit]');button.disabled=true;try{await moderate(pendingReview.entry,pendingReview.newStatus,$('review-reason').value);pendingReview=null;$('review-dialog').close();}catch(e){status('review-feedback',e.message,true);}finally{button.disabled=false;}});
 async function init(){
  renderUser();page(location.hash.slice(1),false);loadCatalog();
  if(!configured){$('service-status').hidden=false;$('service-status').textContent='Login ainda não ativado. Por segurança, não digite senhas até o servidor ser configurado. Os downloads continuam livres.';for(const id of ['login-form','register-form','admin-login']){$(id).querySelectorAll('input,button').forEach(el=>el.disabled=true);}status('admin-login-status','Painel indisponível até configurar o servidor.',true);return;}
  for(const id of ['login-form','register-form','admin-login']){$(id).querySelectorAll('input,button').forEach(el=>el.disabled=false);}if(config.preview)$('admin-login').querySelectorAll('input,button').forEach(el=>el.disabled=true);
  try{user=(await api('/api/me')).user;renderUser();if(location.hash==='#suggestions')loadMine();}catch(e){if(e.code===401)setSession('');else status('login-status',e.message,true);}
 }


 function initLiquidNavigation(){
  const nav=document.querySelector('.site-nav');if(!nav)return;
  const buttons=[...nav.querySelectorAll('[data-page]')],bubble=node('span',undefined,'liquid-nav-bubble');bubble.setAttribute('aria-hidden','true');nav.prepend(bubble);
  let dragging=null,suppressUntil=0,lastX=0;
  const visible=()=>buttons.filter(b=>!b.hidden&&b.getClientRects().length);
  const active=()=>visible().find(b=>b.classList.contains('active'))||visible()[0];
  function place(button,stretch=1){if(!button){bubble.hidden=true;return;}bubble.hidden=false;const nr=nav.getBoundingClientRect(),r=button.getBoundingClientRect();bubble.style.width=r.width+'px';bubble.style.height=r.height+'px';bubble.style.left=(r.left-nr.left+nav.scrollLeft)+'px';bubble.style.top=(r.top-nr.top+nav.scrollTop)+'px';bubble.style.setProperty('--liquid-stretch',String(stretch));}
  const resize=()=>requestAnimationFrame(()=>{document.body.style.setProperty('--agmm-dock-height',nav.getBoundingClientRect().height+'px');if(!dragging)place(active());});
  const nearest=(x,y)=>visible().reduce((best,b)=>{const r=b.getBoundingClientRect(),distance=Math.hypot(Math.max(r.left-x,0,x-r.right),Math.max(r.top-y,0,y-r.bottom));return !best||distance<best.distance?{button:b,distance}:best;},null)?.button;
  function reset(){for(const [key,value] of Object.entries({stretch:'1',squash:'1',offset:'0px',skew:'0deg',tail:'0px'}))bubble.style.setProperty('--liquid-'+key,value);}
  nav.addEventListener('navselection',resize);
  nav.addEventListener('pointerdown',event=>{const button=event.target.closest('[data-page]');if(!button||!nav.contains(button)||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;dragging={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,target:button};lastX=event.clientX;try{nav.setPointerCapture(event.pointerId);}catch{}});
  nav.addEventListener('pointermove',event=>{const nr=nav.getBoundingClientRect();bubble.style.setProperty('--liquid-shine',Math.max(0,Math.min(100,(event.clientX-nr.left)/nr.width*100))+'%');if(!dragging||dragging.id!==event.pointerId)return;if(!dragging.moved&&Math.hypot(event.clientX-dragging.x,event.clientY-dragging.y)<7)return;if(!dragging.moved){dragging.moved=true;try{nav.setPointerCapture(event.pointerId);}catch{}nav.classList.add('liquid-dragging');}event.preventDefault();dragging.target=nearest(event.clientX,event.clientY);const flow=event.clientX-lastX;place(dragging.target,1+Math.min(Math.abs(flow)/55,.36));bubble.style.setProperty('--liquid-squash',String(1-Math.min(Math.abs(flow)/220,.15)));bubble.style.setProperty('--liquid-offset',Math.max(-14,Math.min(14,flow*.55))+'px');bubble.style.setProperty('--liquid-skew',Math.max(-8,Math.min(8,-flow*.3))+'deg');bubble.style.setProperty('--liquid-tail',Math.max(-30,Math.min(30,-flow*1.5))+'px');lastX=event.clientX;},{passive:false});
  function finish(event,cancel=false){if(!dragging||event.pointerId!==undefined&&dragging.id!==event.pointerId)return;const current=dragging;dragging=null;nav.classList.remove('liquid-dragging');reset();try{if(nav.hasPointerCapture(current.id))nav.releasePointerCapture(current.id);}catch{}if(current.moved){suppressUntil=Date.now()+350;if(!cancel&&current.target)page(current.target.dataset.page,false);}place(active());}
  nav.addEventListener('pointerup',event=>finish(event));nav.addEventListener('pointercancel',event=>finish(event,true));nav.addEventListener('lostpointercapture',event=>{if(event.target===nav)finish(event,true);});window.addEventListener('pointerup',event=>finish(event));window.addEventListener('pointercancel',event=>finish(event,true));window.addEventListener('blur',()=>finish({},true));
  nav.addEventListener('click',event=>{if(Date.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
  const header=document.querySelector('header'),positionSelect=$('navigation-position');let savedPosition='bottom';
  try{if(localStorage.getItem('agmm-dock-release')!=='1.0.0'){localStorage.setItem('agmm-navigation-position','bottom');localStorage.setItem('agmm-dock-release','1.0.0');}savedPosition=localStorage.getItem('agmm-navigation-position')||'bottom';}catch{}
  if(!['auto','top','bottom'].includes(savedPosition))savedPosition='bottom';if(positionSelect)positionSelect.value=savedPosition;
  function applyPosition(){const position=savedPosition==='top'?'top':'bottom';document.body.dataset.navPosition=position;if(position==='bottom'){if(nav.parentElement!==document.body)document.body.append(nav);}else if(nav.parentElement!==header)header.append(nav);resize();}
  positionSelect?.addEventListener('change',()=>{savedPosition=positionSelect.value;try{localStorage.setItem('agmm-navigation-position',savedPosition);}catch{}applyPosition();status('navigation-position-status','Posição salva neste navegador.');});applyPosition();
  if('ResizeObserver'in window){const observer=new ResizeObserver(resize);observer.observe(nav);for(const b of buttons)observer.observe(b);}window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);document.fonts?.ready.then(resize);resize();
 }
 // Dock implemented in canary.js, with highlight only while dragging.

 let backgroundPushEnabled=false;try{backgroundPushEnabled=localStorage.getItem('agmm-background-push')==='enabled';}catch{}
 let pushScriptPolicy;
 async function pushRegistration(){const script=new URL('./agmm-sw.js',location.href);let scriptURL=script.href;if(window.trustedTypes){pushScriptPolicy||=trustedTypes.createPolicy('agmm-service-worker',{createScriptURL(value){const approved=new URL('./agmm-sw.js',location.href);if(value!==approved.href)throw new TypeError('Worker não autorizado.');return value;}});scriptURL=pushScriptPolicy.createScriptURL(script.href);}const registration=await navigator.serviceWorker.register(scriptURL,{scope:new URL('./',script).pathname});if(!registration.active)await navigator.serviceWorker.ready;return registration;}
 function pushSupported(){if(config.preview)return false;return isSecureContext&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;}
 function pushManageToken(){let value=localStorage.getItem('agmm-push-device-token');if(!value){value=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');localStorage.setItem('agmm-push-device-token',value);}return value;}
 async function disableBackgroundPush(){if(!pushSupported())return;const registration=await navigator.serviceWorker.getRegistration(new URL('./',location.href).href);const subscription=await registration?.pushManager.getSubscription();if(subscription){const manageToken=localStorage.getItem('agmm-push-device-token');if(manageToken)await api('/api/push/unsubscribe',{method:'POST',data:{endpoint:subscription.endpoint,manageToken}});await subscription.unsubscribe();}backgroundPushEnabled=false;try{localStorage.removeItem('agmm-background-push');}catch{}status('push-status','Notificações com o site fechado desativadas neste dispositivo.');}
 $('push-enable').addEventListener('click',async()=>{const button=$('push-enable');if(!pushSupported()){status('push-status','Este navegador não oferece Web Push. No iPhone/iPad, adicione o site à Tela de Início e abra pelo ícone.',true);return;}const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);if(ios&&!matchMedia('(display-mode: standalone)').matches&&!navigator.standalone){status('push-status','No iPhone/iPad: use Compartilhar → Adicionar à Tela de Início. Abra o AGMM pelo ícone e ative por lá.',true);return;}button.disabled=true;try{const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('A permissão não foi concedida. Você pode alterá-la nas configurações do navegador.');const config=await api('/api/push/key');if(!config.enabled||!config.publicKey)throw new Error('O serviço de notificações ainda não está disponível.');const registration=await pushRegistration();const raw=atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/'));const applicationServerKey=Uint8Array.from(raw,c=>c.charCodeAt(0));const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});await api('/api/push/subscribe',{method:'POST',data:{subscription:subscription.toJSON(),manageToken:pushManageToken()}});localStorage.setItem('agmm-updates-choice','enabled');localStorage.setItem('agmm-background-push','enabled');backgroundPushEnabled=true;linkedPushAccount='';await linkAccountPush();status('push-status','Pronto! Este dispositivo receberá as notas das próximas atualizações, mesmo com a aba fechada. A entrega depende das permissões e das configurações do sistema.');}catch(error){status('push-status',error.message,true);}finally{button.disabled=false;}});
 $('push-test').addEventListener('click',async()=>{const button=$('push-test');button.disabled=true;try{if(!pushSupported())throw new Error('Use um navegador compatível com Web Push.');const registration=await navigator.serviceWorker.getRegistration(new URL('./',location.href).href);const subscription=await registration?.pushManager.getSubscription();if(!subscription)throw new Error('Ative primeiro as notificações neste dispositivo.');await api('/api/push/test',{method:'POST',data:{endpoint:subscription.endpoint,manageToken:pushManageToken()}});status('push-status','Teste aceito pelo serviço de notificações. Confira a central de notificações do seu dispositivo.');}catch(error){status('push-status',error.message,true);}finally{button.disabled=false;}});
 $('push-disable').addEventListener('click',()=>disableBackgroundPush().catch(error=>status('push-status',error.message,true)));
 function initUpdates(){
  const dialog=$('updates-dialog');let pendingNotes=null;
  function showPendingNotes(){if(!pendingNotes||document.querySelector('dialog[open]'))return;const update=pendingNotes;pendingNotes=null;$('release-notes-list').replaceChildren(...update.notes.slice(0,12).map(text=>node('li',String(text))));$('release-notes-summary').textContent=update.message||'Veja o que mudou no AGMM.';save('agmm-release-notes-seen',update.id);$('release-notes-dialog').showModal();}
  for(const modal of document.querySelectorAll('dialog'))modal.addEventListener('close',()=>setTimeout(showPendingNotes,0));
  $('release-notes-close').addEventListener('click',()=>$('release-notes-dialog').close());$('release-notes-refresh').addEventListener('click',()=>location.reload());
  let preference='',baseline='',checking=false,timer;
  try{preference=localStorage.getItem('agmm-updates-choice')||'';baseline=localStorage.getItem('agmm-updates-seen')||'';}catch{}
  function save(key,value){try{localStorage.setItem(key,value);}catch{}}
  function showSettings(){try{preference=localStorage.getItem('agmm-updates-choice')||preference;}catch{}const enabled=preference==='enabled';$('updates-disable').hidden=!enabled;$('updates-enable').hidden=enabled;$('updates-later').hidden=enabled;status('updates-status',enabled?'Alertas ativados neste navegador.':'');if(!dialog.open)dialog.showModal();}
  async function check(){try{preference=localStorage.getItem('agmm-updates-choice')||preference;}catch{}if(checking)return;checking=true;try{let update;try{const response=await fetch(new URL('./agmm-release.json',location.href),{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Indisponível');update=await response.json();}catch{const news=JSON.parse($('nevoa-weekly-review-payload').textContent);update={id:news.id,kind:'update',message:news.title,notes:news.notes};};if(typeof update.id!=='string'||!update.id)return;creationsBadge(update.id);if(update.id!==JSON.parse($('nevoa-weekly-review-payload').textContent).id&&update.kind!=='test'&&Array.isArray(update.notes)&&update.notes.length){let notesSeen='';try{notesSeen=localStorage.getItem('agmm-release-notes-seen')||'';}catch{}if(notesSeen!==update.id||new URL(location.href).searchParams.has('release-notes')){pendingNotes=update;const cleanURL=new URL(location.href);cleanURL.searchParams.delete('release-notes');history.replaceState(null,'',cleanURL.href);showPendingNotes();}}if(preference!=='enabled')return;let testSeen='';try{testSeen=localStorage.getItem('agmm-updates-test-seen')||'';}catch{}if(update.kind==='test'&&testSeen!==update.id){save('agmm-updates-test-seen',update.id);$('updates-test-message').textContent=update.message;const test=$('updates-test-dialog');if(!test.open)test.showModal();if('Notification'in window&&Notification.permission==='granted'){try{new Notification('AGMM — Teste de alertas',{body:update.message,tag:'agmm-site-test'});}catch{}}}if(!baseline){baseline=update.id;save('agmm-updates-seen',baseline);return;}if(update.id===baseline)return;baseline=update.id;save('agmm-updates-seen',baseline);$('updates-message').textContent=update.message||'Uma nova atualização está disponível. Atualize a página para conferir.';$('updates-banner').hidden=false;if(!backgroundPushEnabled&&document.hidden&&update.kind!=='test'&&'Notification'in window&&Notification.permission==='granted'){try{const notification=new Notification('Novidades no AGMM',{body:$('updates-message').textContent,tag:'agmm-site-update'});notification.onclick=()=>{window.focus();notification.close();};}catch{}}}catch{}finally{checking=false;}}
  function start(){clearInterval(timer);check();timer=setInterval(check,60000);}
  $('updates-enable').addEventListener('click',async()=>{preference='enabled';save('agmm-updates-choice',preference);if('Notification'in window&&Notification.permission==='default'){try{await Notification.requestPermission();}catch{}}dialog.close();start();});
  $('updates-disable').addEventListener('click',async()=>{try{await disableBackgroundPush();}catch(error){status('updates-status',error.message,true);return;}preference='disabled';save('agmm-updates-choice',preference);$('updates-banner').hidden=true;dialog.close();});
  function later(){if(!preference){preference='later';save('agmm-updates-choice',preference);}dialog.close();}
  $('updates-later').addEventListener('click',later);$('updates-close').addEventListener('click',later);dialog.addEventListener('cancel',later);
  $('updates-test-close').addEventListener('click',()=>$('updates-test-dialog').close());
  $('updates-settings').addEventListener('click',showSettings);$('updates-reload').addEventListener('click',()=>location.reload());$('updates-dismiss').addEventListener('click',()=>{$('updates-banner').hidden=true;});window.addEventListener('focus',check);
  start();/* Settings open only when requested; avoid interrupting the first visit. */
 }
 if(config.preview){
 for(const id of ['updates-settings','settings-latest-updates'])$(id).addEventListener('click',()=>{$('updates-dialog').showModal();status('push-status','Prévia: notificações reais estão desativadas.');});
 for(const id of ['updates-close','updates-later','updates-enable','updates-disable'])$(id).addEventListener('click',()=>$('updates-dialog').close());
 $('release-notes-close').addEventListener('click',()=>$('release-notes-dialog').close());$('release-notes-refresh').addEventListener('click',()=>location.reload());$('updates-test-close').addEventListener('click',()=>$('updates-test-dialog').close());
 }else{
  initUpdates();$('settings-latest-updates').addEventListener('click',()=>$('release-notes-dialog').showModal());
 }

 init();
})();


