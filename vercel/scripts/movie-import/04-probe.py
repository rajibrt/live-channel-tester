# Probe candidate movie links: HTTP range check + ffprobe (video codec/height, audio codecs).
# usage: python3 -I 04-probe.py <match.json> <out.json> [workers]   (resumes: skips urls already in out.json)
import json, subprocess, sys, os, concurrent.futures as cf, threading
matchf, outf = sys.argv[1:3]; W = int(sys.argv[3]) if len(sys.argv) > 3 else 8
match = json.load(open(matchf))
done = json.load(open(outf)) if os.path.exists(outf) else {}
urls = sorted({c['url'] for v in match.values() for c in v} - set(done))
BROWSER_AUDIO = {'aac', 'mp3', 'opus', 'vorbis', 'flac'}
def probe(url):
    r = {'status': 'error'}
    try:
        p = subprocess.run(['curl', '-s', '-o', '/dev/null', '-m', '15', '-r', '0-0', '-w', '%{http_code} %{size_download}', url], capture_output=True, text=True, timeout=20)
        code = p.stdout.split()[0] if p.stdout else '000'
        r['http'] = code
        if code not in ('200', '206'): r['status'] = 'unreachable' if code == '000' else 'gone'; return url, r
        p = subprocess.run(['ffprobe', '-v', 'error', '-rw_timeout', '15000000', '-show_entries', 'stream=codec_type,codec_name,height:format=duration', '-of', 'json', url], capture_output=True, text=True, timeout=45)
        j = json.loads(p.stdout or '{}'); st = j.get('streams', [])
        v = [s for s in st if s.get('codec_type') == 'video' and s.get('codec_name') not in ('mjpeg', 'png')]
        a = [s.get('codec_name') for s in st if s.get('codec_type') == 'audio']
        if not v: r['status'] = 'bad'; r['err'] = (p.stderr or '')[-120:]; return url, r
        r.update(status='ok', vcodec=v[0].get('codec_name'), height=v[0].get('height') or 0, acodecs=a,
                 audio_ok=any(x in BROWSER_AUDIO for x in a), duration=float(j.get('format', {}).get('duration') or 0))
    except subprocess.TimeoutExpired:
        r['status'] = 'timeout'
    except Exception as e:
        r['err'] = str(e)[:100]
    return url, r
lock = threading.Lock(); n = 0
with cf.ThreadPoolExecutor(W) as ex:
    for url, r in ex.map(probe, urls):
        with lock:
            done[url] = r; n += 1
            if n % 100 == 0:
                json.dump(done, open(outf, 'w')); print(n, len(urls), flush=True)
json.dump(done, open(outf, 'w'))
import collections
print('done', collections.Counter(x['status'] for x in done.values()))
