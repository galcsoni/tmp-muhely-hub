# Egyfájlos teszt-bundle építő.
# A szkriptek sorrendjét magából az index.html-ből olvassa ki, így nem lehet
# elfelejteni frissíteni, ha új modul kerül a projektbe.
import re, sys

banner = sys.argv[1] if len(sys.argv) > 1 else "Teszt verzió"
html_src = open('app/index.html', encoding='utf-8').read()
sorrend = re.findall(r'<script src="(src/[^"]+)"></script>', html_src)

css = open('app/src/styles.css', encoding='utf-8').read()
parts = [open('app/' + p, encoding='utf-8').read() for p in sorrend]
scripts = '\n'.join('<script>\n' + s + '</script>' for s in parts)

html = """<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8" />
<title>TMP Műhely Hub - teszt</title>
<script src="https://www.gstatic.com/firebasejs/9.17.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.17.1/firebase-database-compat.js"></script>
<style>
""" + css + """
.test-banner {
  background: #EDE6DC; color: #6A6560; padding: 8px 16px;
  font-size: 12px; text-align: center; border-bottom: 1px solid #D3C6B2;
  font-family: 'Jost', sans-serif; letter-spacing: 0.04em; text-transform: uppercase;
}
@media print { .test-banner { display: none !important; } }
</style>
</head>
<body>
<div class="test-banner">""" + banner + """</div>
<header class="top-bar">
  <button id="back-btn" class="back-btn">← Vissza</button>
  <div id="brand-btn" class="brand" style="cursor:pointer;">TMP Műhely Hub</div>
  <div class="spacer"></div>
  <div class="status-area">
    <span id="conn-dot" class="conn-dot"></span>
    <span id="conn-label">Kapcsolódás…</span>
    <span id="app-version" class="app-version"></span>
  </div>
</header>
<main id="main-content" class="main-content"></main>

""" + scripts + """
</body>
</html>
"""
open('/home/claude/TMP_teszt.html', 'w', encoding='utf-8').write(html)
print("Bundle:", len(html), "karakter |", len(sorrend), "szkript")
