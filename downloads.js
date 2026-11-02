
// Cole entre as aspas os links oficiais de download de cada versão.
// VERSÃO BETA: altere somente o valor entre aspas abaixo.
const VERSAO_BETA = 'Indisponivel';

// VERSÃO RELEASE: altere somente o valor entre aspas abaixo.
const VERSAO_RELEASE = '1.0';

document.getElementById('versao-beta').textContent = 'Versão Beta: ' + VERSAO_BETA;
if (/indispon|em breve/i.test(VERSAO_BETA)) document.getElementById('versao-beta').classList.add('unavailable');
document.getElementById('versao-release').textContent = 'Versão Release: ' + VERSAO_RELEASE;

// DOWNLOADS BETA: caminhos separados dos arquivos.
const DOWNLOADS_BETA = { dll: '', steam: '', epicStore: '' };
// DOWNLOADS RELEASE: caminhos separados dos arquivos.
const DOWNLOADS_RELEASE = { dll: 'https://github.com/KyroshKazehara/AGMM---All-GameModes-Modified/releases/download/v1.0/AGMM.Release.1.0.dll', steam: 'https://github.com/KyroshKazehara/AGMM---All-GameModes-Modified/releases/download/v1.0/Agmm.-.Steam-1.0.zip', epicStore: '' };
// LAUNCHER ANDROID: publique o APK oficial e preencha URL e versão de cada canal.
const LAUNCHER_RELEASE = {version:'Em breve', files:{apk:''}};
const LAUNCHER_BETA = {version:'Em breve', files:{apk:''}};
for(const [channel,config] of Object.entries({'launcher-release':LAUNCHER_RELEASE,'launcher-beta':LAUNCHER_BETA})) document.getElementById('versao-'+channel).textContent='Versão: '+config.version;

let seed=42;function random(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646}const space=document.querySelector('#space');for(let i=0;i<110;i++){const star=document.createElement('i');star.className='star';const size=random()*2+1;star.style.cssText=`left:${random()*100}%;top:${random()*100}%;width:${size}px;height:${size}px;animation-delay:-${random()*4}s`;space?.append(star)}
const notice=document.querySelector('#notice');
const channels={beta:{version:VERSAO_BETA,files:DOWNLOADS_BETA},release:{version:VERSAO_RELEASE,files:DOWNLOADS_RELEASE},'launcher-release':LAUNCHER_RELEASE,'launcher-beta':LAUNCHER_BETA};
for(const [channel,config] of Object.entries(channels)){
 document.querySelectorAll(`[data-file-version="${channel}"]`).forEach(el=>el.textContent=`Versão ${channel.endsWith('beta')?'Beta':'Release'}: ${config.version}`);
 for(const [kind,path] of Object.entries(config.files)){
  const link=document.getElementById(`${channel}-${kind}`);
  if(path.trim()){link.href=path;link.removeAttribute('aria-disabled');}
  link.addEventListener('click',event=>{if(!path.trim()){event.preventDefault();document.getElementById('download-status').textContent='Este arquivo ainda não está disponível.';}});
 }
}
document.querySelectorAll('[data-channel]').forEach(button=>button.addEventListener('click',()=>{
 const channel=button.dataset.channel;
 document.getElementById('notice-description').textContent=channel==='release'?"AGMM — All GameModes Modified é um mod de Among Us com modos de jogo, funções e opções personalizadas. A Release 1.0 está disponível para Steam no Windows, com DLL avulsa e pacote de instalação. Pode haver bugs. Pacote Steam: extraia o ZIP e copie o conteúdo da pasta interna para a pasta do jogo, ao lado de Among Us.exe. DLL avulsa: com o jogo fechado e BepInEx compatível instalado, substitua a DLL anterior em BepInEx/plugins/.":'Este canal ainda não tem arquivos disponíveis. Confira a Release 1.0 para baixar o mod para Steam no Windows.';
 document.getElementById('notice-title').textContent=({'beta':'Beta Release','release':'LANÇAMENTO OFICIAL · Release 1.0','launcher-release':'AGGM LAUNCHER RELEASE','launcher-beta':'AGGM LAUNCHER BETA'})[channel];
 document.querySelectorAll('.channel-downloads').forEach(section=>section.hidden=section.id!==`downloads-${channel}`);
 document.getElementById('download-status').textContent='';notice.showModal();
}));
notice.addEventListener('click',event=>{if(event.target===notice){const r=notice.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)notice.close();}});
// LINKS OFICIAIS — cole cada endereço entre as aspas.
const LINKS_OFICIAIS = {
  discord1: 'https://discord.gg/WVbwFvehyt', // Primeiro botão do Discord
  discord2: '', // Segundo botão do Discord
  youtube: 'https://www.youtube.com/@Kael_lives_Oficcial',
  twitch: ''
};
for (const [key, id] of Object.entries({discord1:'discord-1',discord2:'discord-2',youtube:'youtube',twitch:'twitch'})) {
  const button = document.getElementById(id);
  const url = LINKS_OFICIAIS[key].trim();
  if (url) {
    button.href = url;
    button.target = '_blank';
    button.rel = 'noopener noreferrer';
    button.removeAttribute('role');
  } else {
    const notify = () => { if(button.tagName === 'A' && button.hasAttribute('href')) return; document.getElementById('official-status').textContent = 'O link oficial deste botão ainda não foi informado.'; };
    button.addEventListener('click', event => { if(button.tagName !== 'A' || !button.hasAttribute('href')) { event.preventDefault(); notify(); } });
    button.addEventListener('keydown', event => { if((event.key === 'Enter' || event.key === ' ') && (button.tagName !== 'A' || !button.hasAttribute('href'))) { event.preventDefault(); notify(); } });
  }
}
