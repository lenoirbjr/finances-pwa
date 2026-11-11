const CACHE='finances-pwa-shell-v3.8.0';
const ASSETS=['./','./index.html','./app.js?v=3.8.0','./style.css?v=3.8.0','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const scopedAssets=new Set(ASSETS.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('finances-pwa-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy)).catch(()=>{})}return res}).catch(async()=>await (await caches.open(CACHE)).match('./index.html')||Response.error()));return;
 }
 if(!scopedAssets.has(url.href))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{try{const res=await fetch(req);if(res.ok)cache.put(req,res.clone()).catch(()=>{});return res}catch{return await cache.match(req)||Response.error()}}));
});
