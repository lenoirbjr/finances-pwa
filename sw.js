const SCOPE=new URL(self.registration.scope);
const PREFIX='diario-financeiro-shell:'+SCOPE.pathname+':';
const VERSION='4.0.52';
const CACHE=PREFIX+VERSION;
const page=new URL('./index.html',SCOPE).href;
const critical=['app.js','scenarios.js','style.css','recon-model.js','recon-ui.js','card-import.js','recon.css'].map(p=>new URL('./'+p+'?v='+VERSION,SCOPE).href);
const staticFiles=['manifest.webmanifest','finance-icon.svg','finance-icon-192.png','finance-icon-512.png','finance-touch-180.png'].map(p=>new URL('./'+p,SCOPE).href);
const scopedAssets=new Set([...critical,...staticFiles]);
const pageMarker='<meta name="diario-shell" content="'+VERSION+'">';
const codeMarker='/* diario-shell:'+VERSION+' */';
async function capture(url,marker){
 const response=await fetch(url,{cache:'reload'});
 if(!response.ok||response.redirected||!(await response.clone().text()).includes(marker))throw Error('A versão publicada ainda não está completa.');
 return [url,response];
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 // GitHub Pages may briefly return files from adjacent deployments. Do not
 // activate or cache an HTML/JS pair until every required resource agrees.
 const entries=await Promise.all([capture(page,pageMarker),...critical.map(url=>capture(url,codeMarker))]);
 const cache=await caches.open(CACHE);
 await Promise.all(entries.map(([url,response])=>cache.put(url,response)));
 await Promise.allSettled(staticFiles.map(url=>cache.add(new Request(url,{cache:'reload'}))));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname))return;
 if(req.mode==='navigate'&&(url.pathname===SCOPE.pathname||url.pathname===new URL(page).pathname)){
  event.respondWith(caches.open(CACHE).then(async cache=>{
   const cached=await cache.match(page);if(cached)return cached;
   try{const [,response]=await capture(page,pageMarker);await cache.put(page,response.clone());return response;}catch{return Response.error();}
  }));
  return;
 }
 if(!scopedAssets.has(url.href))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(url.href);
  if(cached)return cached;
  // Cache storage can be evicted. For active code, never accept another version.
  if(critical.includes(url.href))try{
   const [,response]=await capture(url.href,codeMarker);
   await cache.put(url.href,response.clone());
   return response;
  }catch{return Response.error();}
  return fetch(req);
 }));
});
