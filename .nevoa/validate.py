import json, pathlib, subprocess, sys
from html.parser import HTMLParser
class Inspector(HTMLParser):
 def __init__(self):super().__init__();self.h1=0;self.images=0;self.noalt=0;self.viewport=False;self.scripts=[];self.collect=False;self.current=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='script' and not a.get('src') and a.get('type','').lower() in ('','text/javascript','module'):self.collect=True;self.current=[]
  if tag=='h1':self.h1+=1
  if tag=='img':self.images+=1;self.noalt+=int('alt' not in a)
  if tag=='meta' and a.get('name')=='viewport':self.viewport=True
 def handle_data(self,data):
  if self.collect:self.current.append(data)
 def handle_endtag(self,tag):
  if tag=='script' and self.collect:self.scripts.append(''.join(self.current));self.collect=False
p=pathlib.Path('index.html')
if not p.is_file():raise SystemExit('::error::index.html ausente')
s=p.read_text(encoding='utf-8-sig');i=Inspector();i.feed(s)
w=[]
if not i.viewport:w.append('Meta viewport ausente')
if i.h1!=1:w.append(f'{i.h1} títulos h1; revisar estrutura das telas')
if i.noalt:w.append(f'{i.noalt} imagens sem alt')
if 'alert(' in s:w.append('alert() encontrado; confira o comportamento no navegador local')
errors=[]
for number,script in enumerate(i.scripts,1):
 checked=subprocess.run(['node','--check','--input-type=module'],input=script,text=True,capture_output=True)
 if checked.returncode:errors.append(f'Sintaxe inválida no script inline {number}');print('::error::'+errors[-1])
for message in w:print('::warning::'+message)
report={'arquivo':'index.html','avisos':w,'erros':errors,'scope':'Inspeção estática. Não executa login, backend ou interações do usuário.'}
pathlib.Path('.nevoa/relatorio-ci.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
if errors:sys.exit(1)
