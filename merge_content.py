# Merge the study-plan content pack (data/content/*.json) into the app's data files.
import json,sys,os
root=sys.argv[1]; C=os.path.join(root,'data','content'); D=os.path.join(root,'data')
L=lambda p:json.load(open(p,encoding='utf-8'))
W=lambda p,o:json.dump(o,open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=0)
base=L(os.path.join(D,'base','vocab.json')); new=L(os.path.join(C,'vocab.json'))
words={c['w'] for c in new}; W(os.path.join(D,'vocab.json'), new+[c for c in base if c['w'] not in words])
base=L(os.path.join(D,'base','decode.json')); new=L(os.path.join(C,'decode.json'))
words={c['w'] for c in new}; W(os.path.join(D,'decode.json'), new+[c for c in base if c['w'] not in words])
base=L(os.path.join(D,'base','tasks.json')); new=L(os.path.join(C,'tasks.json'))
out={k: new.get(k,[])+base.get(k,[]) for k in set(base)|set(new)}
out['party']=L(os.path.join(C,'dialogues.json'))
W(os.path.join(D,'tasks.json'),out)
W(os.path.join(D,'missions.json'),L(os.path.join(C,'missions.json')))
W(os.path.join(D,'workbook.json'),L(os.path.join(C,'workbook.json')))
print({k:len(v) for k,v in out.items()}, 'vocab',len(L(os.path.join(D,'vocab.json'))),'decode',len(L(os.path.join(D,'decode.json'))))
