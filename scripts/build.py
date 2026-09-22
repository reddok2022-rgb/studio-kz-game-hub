"""Build a dependency-free static index, canonical landings and untouched games."""
from pathlib import Path
from html import escape
import json
import os
import re
import shutil
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'
SITE_URL = os.environ.get('SITE_URL', 'https://reddok2022-rgb.github.io/studio-kz-game-hub').rstrip('/')
games = json.loads((ROOT / 'data/games.json').read_text())

def page(title, description, body, prefix, route):
    return f'''<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#090909">
  <title>{escape(title)}</title>
  <meta name="description" content="{escape(description, quote=True)}">
  <link rel="canonical" href="{escape(SITE_URL + route, quote=True)}">
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="{prefix}assets/hub.css">
</head>
<body>
  <a class="skip" href="#main">본문으로</a>
  <div class="shell">
    {body}
  </div>
</body>
</html>
'''

assert len({g['id'] for g in games}) == len(games), 'Duplicate game ID'
for g in games:
    assert re.fullmatch(r'\d{3}', g['id']), 'Invalid game ID'
    assert (ROOT / 'public' / g['visual']).is_file(), 'Missing release visual'
    for p in g['platforms']:
        if not urlparse(p['href']).scheme:
            assert (ROOT / 'public' / g['id'] / p['href'] / 'index.html').is_file(), 'Missing playable build'
        else:
            assert urlparse(p['href']).scheme == 'https', 'External platforms require HTTPS'

if OUT.exists():
    shutil.rmtree(OUT)
shutil.copytree(ROOT / 'public', OUT)
(OUT / '.nojekyll').touch()

cards = []
for g in games:
    title = escape(g['title'])
    cards.append(f'''<article class="game-entry">
      <a class="visual-link" href="{g['id']}/" aria-label="GAME.{g['id']} 〈{title}〉 작품 페이지"><img class="release-visual" src="{escape(g['visual'])}" width="1061" height="1123" alt="{escape(g['visualAlt'])}" fetchpriority="high"></a>
      <div class="entry-copy"><p class="eyebrow">GAME.{g['id']}</p><h2><a href="{g['id']}/">〈{title}〉</a></h2><p class="description">{escape(g['description'])}</p><p class="metadata">{' · '.join(escape(p['name']) for p in g['platforms'])} <span>{escape(g['year'])}</span></p><a class="entry-link" href="{g['id']}/">게임 보기 <span aria-hidden="true">↗</span></a></div>
    </article>''')
body = '<main id="main"><h1 class="index-title">GAME</h1><div class="game-index">' + '\n'.join(cards) + '</div></main>'
(OUT / 'index.html').write_text(page('GAME', 'GAME', body, './', '/'))

for g in games:
    title = escape(g['title'])
    buttons = '\n'.join(f'<a class="play-entry" href="{escape(p["href"], quote=True)}">{escape(p["label"])}<span aria-hidden="true">↗</span></a>' for p in g['platforms'])
    body = f'''<main id="main" class="landing">
      <nav class="back-nav" aria-label="상위 페이지"><a href="../">← GAME</a></nav>
      <article class="game-entry">
        <img class="release-visual" src="../{escape(g['visual'])}" width="1061" height="1123" alt="{escape(g['visualAlt'])}" fetchpriority="high">
        <div class="entry-copy"><p class="eyebrow">GAME.{g['id']}</p><h1>〈{title}〉</h1><p class="description">{escape(g['description'])}</p><p class="metadata">{' · '.join(escape(p['name']) for p in g['platforms'])} <span>{escape(g['year'])}</span></p><div class="platforms">{buttons}</div></div>
      </article>
    </main>'''
    (OUT / g['id']).mkdir(exist_ok=True)
    (OUT / g['id'] / 'index.html').write_text(page(f'GAME.{g["id"]} 〈{g["title"]}〉', g['description'], body, '../', f'/{g["id"]}/'))
print(f'Built {len(games)} game landing(s) → {OUT}')
