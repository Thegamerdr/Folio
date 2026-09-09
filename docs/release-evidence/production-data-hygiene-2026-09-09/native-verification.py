import json, re, subprocess, sys, time
from pathlib import Path
import xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')

ADB = r'C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe'
SERIAL = '2af26a2c19017ece'
PACKAGE = 'com.folio.v2.greenfield'
EVIDENCE = Path(r'C:\dev\melo-native-today-batch1-2026-08-24\docs\release-evidence\production-data-hygiene-2026-09-09')
EVIDENCE.mkdir(parents=True, exist_ok=True)

def adb(*args, binary=False):
    p = subprocess.run([ADB, '-s', SERIAL, *args], capture_output=True, timeout=60)
    if p.returncode:
        raise RuntimeError(p.stderr.decode(errors='replace'))
    return p.stdout if binary else p.stdout.decode(errors='replace').strip()

def dump(label='current', verbose=True):
    adb('shell', 'rm', '-f', '/sdcard/melo-hygiene.xml')
    result=adb('shell', 'uiautomator', 'dump', '--compressed', '/sdcard/melo-hygiene.xml')
    if 'UI hierchary dumped' not in result:
        raise RuntimeError(result)
    xml = adb('shell', 'cat', '/sdcard/melo-hygiene.xml')
    (EVIDENCE / f's9-{label}.xml').write_text(xml, encoding='utf-8')
    root = ET.fromstring(xml)
    for n in root.iter('node'):
        if verbose and (n.get('text') or n.get('content-desc')):
            print(json.dumps({k:n.get(k) for k in ('text','content-desc','bounds','class')},ensure_ascii=False))
    return root

def tap(label):
    root = dump(verbose=False)
    matches = [n for n in root.iter('node') if label == n.get('content-desc')]
    if not matches:
        matches = [n for n in root.iter('node') if label == n.get('text')]
    if not matches:
        matches = [n for n in root.iter('node') if label in (n.get('content-desc') or '')]
    if len(matches) != 1:
        raise RuntimeError(f'{label}: {len(matches)} matches')
    x1,y1,x2,y2 = map(int,re.findall(r'\d+',matches[0].get('bounds')))
    print(label, matches[0].get('bounds'))
    print(adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2)))

def screenshot(label):
    (EVIDENCE/f's9-{label}.png').write_bytes(adb('exec-out','screencap','-p',binary=True))

def field(label,value):
    tap(label)
    adb('shell','input','keyevent','123')
    adb('shell','input','keyevent',*(['67']*24))
    adb('shell','input','text',str(value).replace(' ','%s'))
    adb('shell','input','keyevent','4')

def assert_screen(label, includes=(), excludes=()):
    root=dump(label, verbose=False)
    content='\n'.join((n.get('text','')+' '+n.get('content-desc','')) for n in root.iter('node'))
    result={'time':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'label':label,
            'includes':list(includes),'excludes':list(excludes),
            'pass':all(v in content for v in includes) and all(v not in content for v in excludes)}
    with (EVIDENCE/'s9-assertions.jsonl').open('a',encoding='utf-8') as f:
        f.write(json.dumps(result,ensure_ascii=False)+'\n')
    assert result['pass'],result
    screenshot(label)

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    action=sys.argv[1]
    if action=='dump': dump(sys.argv[2] if len(sys.argv)>2 else 'current')
    elif action=='tap': tap(sys.argv[2])
    elif action=='shot': screenshot(sys.argv[2])
    elif action=='text': print(adb('shell','input','text',sys.argv[2].replace(' ','%s')))
    elif action=='key': print(adb('shell','input','keyevent',sys.argv[2]))
    elif action=='swipe': print(adb('shell','input','swipe',*sys.argv[2:]))
