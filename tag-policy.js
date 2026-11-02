(function(root){'use strict';
const colors=Object.freeze(['#ff6577','#ffe26b','#70dfb0','#75bcff','#c99bff','#ffffff']);
const price=200,min=3,max=18;
const reserved=['desenvolvedor','desenvolvedora','desenvolvimento','developer','development','dev','youtuber','youtube','ytuber','criador','criadora','creator','creador','fundador','fundadora','founder','cofundador','cofunxdador','cofounder','ceo'];
const lookalikes={'ɛ':'e','ᴇ':'e','ɗ':'d','ᴅ':'d','ʋ':'v','ᴠ':'v','ʏ':'y','ᴏ':'o','ʀ':'r','ʟ':'l','ɪ':'i','ɑ':'a','ɡ':'g','ƅ':'b','ß':'ss','ı':'i','ſ':'s'};
function fold(text){text=[...text].map(c=>lookalikes[c]||c).join('');return text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[0123456789]/g,c=>({'0':'o','1':'i','2':'z','3':'e','4':'a','5':'s','6':'g','7':'t','8':'b','9':'g'}[c])).replace(/[^a-z]/g,'')}
function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){let next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1)));row=next}return row[b.length]}
function validate(name,color){
 if(typeof name!=='string'||typeof color!=='string')return {ok:false,error:'Preencha o texto e escolha uma cor.'};
 const text=name.normalize('NFKC').trim().replace(/ +/g,' ');
 if(!colors.includes(color))return {ok:false,error:'Escolha uma das cores disponíveis.'};
 // Reject controls, markup, invisible characters and cross-script impersonation.
 if(!/^[\p{Script=Latin}\p{M}0-9 _-]+$/u.test(text)||!/\p{Script=Latin}/u.test(text))return {ok:false,error:'Use letras, números, espaço, hífen ou sublinhado. Sem símbolos ou formatação.'};
 const count=[...text].length;
 if(count<min||count>max)return {ok:false,error:`Use de ${min} a ${max} caracteres.`};
 const key=fold(text),parts=text.split(/[ _-]+/).map(fold);
 if(reserved.some(r=>key.includes(r)||r.length>=6&&parts.some(p=>distance(p,r)<=1)))return {ok:false,error:'Esse título é exclusivo. Escolha um nome que não imite equipe, criadores ou fundadores.'};
 return {ok:true,text,color};
}
const api=Object.freeze({colors,price,min,max,validate});if(typeof module!=='undefined')module.exports=api;else root.TagPolicy=api;
})(typeof window==='undefined'?globalThis:window);
