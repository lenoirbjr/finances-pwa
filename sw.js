const SCOPE=new URL(self.registration.scope);
const LEGACY_PREFIX='finances-pwa-shell-';
const PREFIX='diario-financeiro-shell:'+SCOPE.pathname+':';
const CACHE=PREFIX+'4.0.19';
const ASSETS=['./','./index.html','./app.js?v=4.0.19','./scenarios.js?v=4.0.19','./style.css?v=4.0.19','./recon-model.js?v=4.0.19','./recon-ui.js?v=4.0.19','./card-import.js?v=4.0.19','./recon.css?v=4.0.19','./manifest.webmanifest','./finance-icon.svg','./finance-icon-192.png','./finance-icon-512.png','./finance-touch-180.png'];
const scopedAssets=new Set(ASSETS.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(async key=>{
 if(key.startsWith(PREFIX))return caches.delete(key);
 if(!key.startsWith(LEGACY_PREFIX))return;
 const old=await caches.open(key);
 if(!await old.match(new URL('./index.html',SCOPE).href))return;
 const entries=await old.keys();
 if(entries.every(request=>{
  const url=new URL(request.url);
  return url.origin===SCOPE.origin&&url.pathname.startsWith(SCOPE.pathname);
 }))return caches.delete(key);
}))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy)).catch(()=>{})}return res}).catch(async()=>await (await caches.open(CACHE)).match('./index.html')||Response.error()));return;
 }
 if(!scopedAssets.has(url.href))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{try{const res=await fetch(req);if(res.ok)cache.put(req,res.clone()).catch(()=>{});return res}catch{return await cache.match(req)||Response.error()}}));
});
