(()=>{
'use strict';
const target=Date.parse('2026-11-14T18:00:00-03:00');
const section=document.getElementById('estreia');
if(!section)return;
function update(){
 const remaining=Math.max(0,Math.ceil((target-Date.now())/1000));
 const values={days:Math.floor(remaining/86400),hours:Math.floor(remaining%86400/3600),minutes:Math.floor(remaining%3600/60),seconds:remaining%60};
 for(const [key,value]of Object.entries(values))section.querySelector('[data-premiere="'+key+'"]').textContent=String(value).padStart(2,'0');
 if(!remaining){document.getElementById('premiere-status').textContent='Chegou a hora! Abra o vídeo no YouTube.';section.classList.add('premiere-started');clearInterval(timer);}
}
let timer=setInterval(update,1000);update();document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
})();
