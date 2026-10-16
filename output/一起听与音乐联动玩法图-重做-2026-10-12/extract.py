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
names=['taSwitchSong','saveListen','resolveSong','patchSongEverywhere','toggleFav','cyclePlayMode','cloneSong','createPlaylist','deletePlaylist','renamePlaylist','addToPlaylist','removeFromPlaylist','acceptListenInvite','setListenPartner','resultToSong','addNeteaseResult','addResultToPlaylist','playNeteaseResult','playNeteaseList','saveCoupleDisc','discSongsOf','discAdd','discSetNote','discRemove','discPlay','discNextId','discEnter','discLeave','discSpinning','roomMusicEnter','roomMusicLeave','phonePlaylistOf','phoneMusicMine','phoneMusicNextId','phoneMusicEnter','phoneMusicLeave','parseSongWants','neteaseSearchOne','collectRealSongs','genCharPlaylist','genCoupleDisc','phonePeekTag','forwardPhonePeekToChat']
chunks=[];evidence=[]
for name in names:
    match=re.search(r'\bconst '+name+r'\s*=',s);assert match,name
    a=match.start();b=statement(a);chunks.append(s[a:b]);evidence.append({'name':name,'startLine':s[:a].count('\n')+1,'sha256':hashlib.sha256(s[a:b].encode()).hexdigest()})
branches=[]
for name in ['songSwitch','listenInvite','carve']:
    m=re.search(r'if \(parsed\.'+name+r'\b',s);assert m,name
    a=m.start();b=statement(a);branches.append(s[a:b]);evidence.append({'name':'parsed.'+name,'startLine':s[:a].count('\n')+1})
# The callback is the actual object-property arrow passed by App to ListenTogether.
m=re.search(r'onToChat: ([^\n]+)',s);assert m
callback=m.group(1).rstrip().rstrip(',')
deps='listenRef,listen,setListen,saveJSON,setCoupleDisc,coupleDiscRef,playerSongIdRef,audioElRef,roomMusicRef,setPlayer,playSong,stopPlayer,stepSong,goListen,musicReady,musicProvider,musicRequest,neteaseTrackInfo,active,ctxFor,toast,setGen,pChat,notifyApp'
text='window.__nativeMusic = function(env){\nconst {'+deps+'}=env;\n'+'\n'.join(chunks)+'\nconst onToChat='+callback+';\nconst applyParsed=async(parsed,char)=>{const charId=char.id,chatKey=charId,turnId="demo-turn",isCouple=true;let delivered=false;\n'+'\n'.join(branches)+'\nreturn delivered;};\nreturn {'+','.join(names)+',onToChat,applyParsed};\n};\n'
(ROOT/'native-writers.js').write_text(text)
(ROOT/'native-extraction.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
print('Extracted original handlers:',len(names),'branches:',len(branches))
