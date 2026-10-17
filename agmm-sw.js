'use strict';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 const root=new URL('./',self.registration.scope);
 event.waitUntil(self.registration.showNotification(typeof data.title==='string'?data.title:'Novidades no AGMM',{
  body:typeof data.body==='string'?data.body:'Uma nova atualização está disponível. Toque para ver as notas.',
  icon:new URL('agmm-icon.png',root).href,badge:new URL('agmm-icon.png',root).href,
  tag:'agmm-release-'+String(data.id||'latest').slice(0,100),
  data:{url:new URL(data.kind==='suggestion'?'?suggestion-alert=1#suggestions':'?release-notes=1#home',root).href}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=new URL(event.notification.data?.url||'./',self.registration.scope);
 if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 event.waitUntil((async()=>{const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clients){if(client.url.startsWith(self.registration.scope)&&'focus'in client){await client.navigate(url.href);return client.focus();}}return self.clients.openWindow(url.href);})());
});
