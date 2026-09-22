"""Release packaging checks: real routes, local links and immutable game hashes."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'
manifest = json.loads((ROOT / 'docs/GAME_001_BUILD_MANIFEST.json').read_text())
for base in (ROOT / 'public/001/play', OUT / '001/play'):
    actual = {str(p.relative_to(base)): hashlib.sha256(p.read_bytes()).hexdigest() for p in base.rglob('*') if p.is_file()}
    assert actual == manifest['files'], f'GAME.001 differs from approved release: {base}'

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('href', 'src') and value:
                self.urls.append(value)

for path in OUT.rglob('*.html'):
    parser = Links()
    parser.feed(path.read_text())
    for url in parser.urls:
        parsed = urlparse(url)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        assert not parsed.path.startswith('/'), f'Root-relative link breaks project Pages: {url}'
        target = (path.parent / unquote(parsed.path)).resolve()
        assert target.is_relative_to(OUT.resolve()), f'Link escapes site: {url}'
        if target.is_dir():
            target /= 'index.html'
        assert target.is_file(), f'Broken local link in {path}: {url}'
for route in ('index.html','001/index.html','001/play/index.html'):
    assert (OUT / route).is_file(), f'Missing direct route: {route}'
assert not (OUT / 'CNAME').exists(), 'Custom domain must wait for public QA'
print(f'PASS: direct-route files, local links, and {len(manifest["files"])} unchanged game files')
