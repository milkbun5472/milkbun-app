from pathlib import Path
import re,json,hashlib
ROOT=Path(__file__).resolve().parent
s=(ROOT/'product-source/js/app.js').read_text()
def statement(start):
    stack=[];quote=None;comment=None;i=start;regex=False;charclass=False;previous=''
    while i<len(s):
        c=s[i];n=s[i:i+2]
        if regex:
            if c=='\\':i+=1
            elif c=='[':charclass=True
            elif c==']':charclass=False
            elif c=='/' and not charclass:regex=False
        elif comment=='line':
            if c=='\n':comment=None
        elif comment=='block':
            if n=='*/':comment=None;i+=1
        elif quote:
            if c=='\\':i+=1
            elif c==quote:quote=None
        elif n=='//':comment='line';i+=1
        elif n=='/*':comment='block';i+=1
        elif c=='/' and (previous in '=(:,[!&|?' or s[max(start,i-8):i].rstrip().endswith('return')):regex=True
        elif c in "'\"`":quote=c
        elif c in '([{':stack.append(c)
        elif c in ')]}':
            assert stack
            assert stack.pop()=={')':'(',']':'[','}':'{'}[c]
            if not stack and c=='}' and s[start:start+2]=='if':return i+1
        elif c==';' and not stack:return i+1
        if not c.isspace() and not quote and not comment and not regex:previous=c
        i+=1
    raise ValueError(start)
names=['STUDIO_CAP','STUDIO_THEMES','customThemes','studioThemeOf','comicCompose','polaroidCompose','studioOverlay','coverCopy','studioShoot','myClosetText','photoMe','closetTextFor','wearsOnDay','genPhotoDiary','shareShotToChat','cleanDrawSvg','drawBackOn']
assignments=['__studioThemes','__studioThemeSave','__studioThemeDel','__developPolaroid','__addSelfSticker']
chunks=[];evidence=[]
for name in names:
    m=re.search(r'\bconst '+name+r'\s*=',s);assert m,name
    a=m.start();b=statement(a);chunks.append(s[a:b]);evidence.append({'name':name,'startLine':s[:a].count('\n')+1,'sha256':hashlib.sha256(s[a:b].encode()).hexdigest()})
for name in assignments:
    m=re.search(r'window\.'+name+r'\s*=',s);assert m,name
    a=m.start();b=statement(a);chunks.append(s[a:b]);evidence.append({'name':'window.'+name,'startLine':s[:a].count('\n')+1,'sha256':hashlib.sha256(s[a:b].encode()).hexdigest()})
deps='profile,characters,statesRef,stateHistRef,carryRef,myClosetRef,studioRef,setStudio,setGen,saveJSON,toast,apiFor,ctxFor,photoDiaryBusy,setPhotoDiaryBusy,setDiaries,scheduleTextFor,schedDayKey,pChat,setActiveChar,setScreen,emotePacksRef,commitEmotePacks'
text='window.__nativePhotos = function(env){\nconst {'+deps+'}=env;\n'+'\n'.join(chunks)+'\nreturn {'+','.join(names)+'};\n};\n'
(ROOT/'native-writers.js').write_text(text)
(ROOT/'native-extraction.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
print('Extracted',len(names),'original declarations and',len(assignments),'original global handlers')
