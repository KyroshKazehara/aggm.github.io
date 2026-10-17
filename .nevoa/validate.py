import json, pathlib
from html.parser import HTMLParser
class Inspector(HTMLParser):
 def __init__(self):super().__init__();self.h1=0;self.images=0;self.noalt=0;self.viewport=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='h1':self.h1+=1
  if tag=='img':self.images+=1;self.noalt+=int('alt' not in a)
  if tag=='meta' and a.get('name')=='viewport':self.viewport=True
p=pathlib.Path('index.html')
if not p.is_file():raise SystemExit('::error::index.html ausente')
s=p.read_text(encoding='utf-8-sig');i=Inspector();i.feed(s)
w=[]
if not i.viewport:w.append('Meta viewport ausente')
if i.h1!=1:w.append(f'{i.h1} títulos h1; revisar estrutura das telas')
if i.noalt:w.append(f'{i.noalt} imagens sem alt')
if 'alert(' in s:w.append('alert() encontrado; confira o comportamento no navegador local')
for message in w:print('::warning::'+message)
report={'arquivo':'index.html','avisos':w,'scope':'Inspeção estática. Não executa login, backend ou interações do usuário.'}
pathlib.Path('.nevoa/relatorio-ci.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
