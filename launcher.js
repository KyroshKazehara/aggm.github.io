(() => {
 const seed=JSON.parse(document.getElementById('launcher-confirmed-seed').textContent);
 const distributions={};
 const seenLauncherVersions=new Set();
 function launcherSeenKey(channel,item){return 'agmm-launcher-opened-v1:'+channel+':'+item.version+':'+item.versionCode+':'+item.url;}
 function launcherWasSeen(channel,item){const key=launcherSeenKey(channel,item);try{return seenLauncherVersions.has(key)||localStorage.getItem(key)==='1';}catch{return seenLauncherVersions.has(key);}}
 function markLauncherSeen(channel,item){const key=launcherSeenKey(channel,item);seenLauncherVersions.add(key);try{localStorage.setItem(key,'1');}catch{}document.getElementById('launcher-main-'+channel).classList.add('launcher-seen');}

 const dialog=document.getElementById('launcher-details');
 const versionText=item=>item.version.endsWith('-beta')?'Beta '+item.version.slice(0,-5):item.version;
 function showDetails(channel){
  const item=distributions[channel];if(!valid(item))return;
  document.getElementById('launcher-details-title').textContent=item.title;
  document.getElementById('launcher-details-status').textContent=versionText(item)+' · '+item.label;
  document.getElementById('launcher-details-status').classList.toggle('without-mod',!!item.withoutMod);
  const apk=document.getElementById('launcher-details-apk');apk.href=item.url;
  apk.querySelector('.apk-label').textContent=channel==='release'?'📱 Baixar APK · Release 1.0 🎉':'Baixar APK BETA';
  dialog.dataset.channel=channel;
  document.getElementById('launcher-details-version').textContent=versionText(item)+(item.sizeBytes?' · '+(item.sizeBytes/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB':'');
  const notes=document.getElementById('launcher-details-notes');notes.replaceChildren();
  for(const line of (item.notes||'Informações oficiais indisponíveis nesta consulta.').split(/\r?\n/)){
   if(!line.trim())continue;const heading=/^#{1,6}\s+/.test(line);const el=document.createElement(heading?'h3':'p');
   el.textContent=line.replace(/^#{1,6}\s+/,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1');notes.append(el);
  }
  dialog.dataset.channel=channel;dialog.showModal();
  markLauncherSeen(channel,item);
 }
 document.getElementById('launcher-details-close').addEventListener('click',()=>dialog.close());
 for(const channel of ['beta','release'])document.getElementById('launcher-main-'+channel).addEventListener('click',()=>showDetails(channel));
 const prefix='https://github.com/KyroshKazehara/AGMM---LAUNCHER/releases/download/';
 function valid(item){return item&&typeof item.title==='string'&&item.title.length<=300&&typeof item.label==='string'&&item.label.length<=100&&typeof item.version==='string'&&typeof item.url==='string'&&item.url.startsWith(prefix)&&item.url.endsWith('/AGMM-Launcher.apk')&&/^\d+(?:\.\d+)+(?:[-+][\w.-]+)?$/.test(item.version);}
 function apply(data){for(const channel of ['beta','release']){
  const item=data[channel];if(!valid(item))continue;const current=distributions[channel];if(current&&Number.isSafeInteger(current.versionCode)&&(!Number.isSafeInteger(item.versionCode)||item.versionCode<current.versionCode))continue;distributions[channel]=item;
  const suffix=item.version.endsWith('-beta')?'Beta '+item.version.slice(0,-5):item.version;
  const label='Baixar AGMM Launcher — '+suffix+' · '+item.label;
  const main=document.getElementById('launcher-main-'+channel);
  const badge=main.querySelector('.badge');badge.textContent=item.label;
  main.querySelector('.launcher-button-title').textContent=channel==='release'?'🎉📱 Launcher Release':'🧪 Launcher Beta';
  document.getElementById('versao-launcher-'+channel).textContent=suffix+' · '+item.label;
  main.disabled=false;main.classList.add('launcher-available');main.classList.toggle('launcher-seen',launcherWasSeen(channel,item));main.removeAttribute('aria-disabled');main.setAttribute('aria-label','Ver versão do AGMM Launcher — '+suffix+' · '+item.label);main.title=item.title;
  const old=document.getElementById('launcher-'+channel+'-apk');if(old){const link=old.cloneNode(true);old.replaceWith(link);link.href=item.url;link.removeAttribute('aria-disabled');link.querySelector('span').textContent=label;}
  document.querySelectorAll('[data-file-version="launcher-'+channel+'"]').forEach(el=>el.textContent=suffix+' · '+item.label);
 }}
 window.AGMMLauncherPreview=Object.freeze({applyDraft(versions){const data={};for(const channel of ['release','beta']){const v=versions['android-'+channel];if(v?.url&&v.version){data[channel]={...seed[channel],title:v.title,version:v.version.replace(/^v/,''),notes:v.description,url:v.url,label:'Rascunho local · '+(channel==='release'?'Release':'Beta')};}}apply(data);},applyPublished(versions){const data={};for(const channel of ['release','beta']){const v=versions['android-'+channel];if(v?.url&&v.version){const version=v.version.replace(/^v/,''),label=channel==='release'?'Release '+version+' · Mod incluído':'Prévia — sem mod';data[channel]={...seed[channel],title:v.title,version,notes:v.description,url:v.url,label};}}apply(data);}});
 apply(seed);
 // Confirmed seed and signature-verifying local endpoint are the version sources.
 async function refresh(){try{const response=await fetch('/api/launcher-distribution',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)return;const data=await response.json();apply(data);localStorage.setItem('agmm-launcher-confirmed-v1',JSON.stringify(data));}catch{}}
 refresh();setInterval(()=>{if(!document.hidden)refresh();},300000);window.addEventListener('focus',refresh);
})();
