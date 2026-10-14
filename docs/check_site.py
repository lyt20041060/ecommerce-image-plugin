"""Dependency-free structural checks; does not replace a browser or CSS validator."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import hashlib
import re
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

class PageCheck(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.ids, self.references = [], set(), []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag not in VOID:
            self.stack.append(tag)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, 'Duplicate ID: ' + attrs['id']
            self.ids.add(attrs['id'])
        for name in ('href', 'src'):
            if attrs.get(name):
                self.references.append(attrs[name])
        assert not any(name.startswith('on') for name in attrs), 'Inline event handler'
        if tag == 'img':
            assert 'alt' in attrs, 'Image missing alt'

    def handle_endtag(self, tag):
        assert self.stack and self.stack[-1] == tag, 'Unbalanced HTML tag: ' + tag
        self.stack.pop()

html = (ROOT / 'index.html').read_text(encoding='utf-8')
parser = PageCheck()
parser.feed(html)
parser.close()
assert not parser.stack, parser.stack
assert '<!doctype html>' in html.lower()
assert 'lang="zh-CN"' in html
for ref in parser.references:
    if ref.startswith('#'):
        assert ref[1:] in parser.ids, 'Missing anchor: ' + ref
    else:
        parts = urlsplit(ref)
        assert not parts.scheme and not parts.netloc and not ref.startswith('/'), 'Non-relative resource: ' + ref
        target = (ROOT / unquote(parts.path)).resolve()
        assert ROOT in target.parents, 'Outside docs: ' + ref
        assert target.is_file(), 'Missing resource: ' + ref
print('PASS: HTML nesting, unique IDs, image alt, relative resources, anchors')

css = (ROOT / 'css/style.css').read_text(encoding='utf-8')
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
css = re.sub(r'"(?:\\.|[^"\\])*"|\x27(?:\\.|[^\x27\\])*\x27', 'STRING', css)
stack = []
for char in css:
    if char in '{([':
        stack.append(char)
    elif char in '})]':
        assert stack and stack.pop() == {'}': '{', ')': '(', ']': '['}[char], 'CSS bracket mismatch'
assert not stack, 'Unclosed CSS brackets'
assert '@import' not in css, 'Unexpected remote stylesheet'
assert '@media' in css and 'prefers-reduced-motion' in css
print('PASS: CSS brackets, responsive rules, reduced motion (structural check only)')

for svg in (ROOT / 'assets').glob('*.svg'):
    ET.parse(svg)
print('PASS: SVG XML parses')

files = ['manifest.json', 'shared.js', 'background.js', 'content.js', 'content.css', 'gallery.html', 'gallery.js', 'gallery.css', 'README.md']
expected_hashes = {
    'manifest.json': '0683884AE961051BD9B95384ACB2C439715643E6F8D1572B480534738852BE9D',
    'background.js': '0E54E0AE1288C5F717424C52A0BAA671E1E6297BF2CF184652994308C4170FDC',
    'content.js': '4159BC748D04204E48361831FB1F938B96794BC40D2C2597772EE78B38F9FEAC',
    'content.css': 'CB10DEB32396A91FC70D393A18B6846B87C70625DDE09624EB4C3B6139900E67',
    'shared.js': 'DFB153100909A4E70ED21F8091E986C8BEEFA628313164C859A19779B1078A96',
    'gallery.html': '120F2646CD4A1C47DEC46BB11FEE2524933EF39DB6B429E4E789CB9867B5F1AD',
    'gallery.js': '4086B4EA8D8DE826AEF0E3243FF72164D40F0BEC4D762508C6BD69FE584D52CB',
    'gallery.css': 'D43CA89A70BF7BB9997E302DB30108494194CA81D10E6A199EB87AD878056151',
    'README.md': 'DF473B70F3B7A9B7C8FFB94784107DF0D883F2D5405CF3815D44392A610923EB'
}
with zipfile.ZipFile(ROOT / 'assets/product-image-helper-v1.0.0.zip') as package:
    assert set(package.namelist()) == set(files), 'Unexpected ZIP content'
    assert package.testzip() is None, 'Corrupt ZIP'
    for filename in files:
        original = (PROJECT / filename).read_bytes()
        assert package.read(filename) == original, 'ZIP differs: ' + filename
        assert hashlib.sha256(original).hexdigest().upper() == expected_hashes[filename], 'Original changed: ' + filename
print('PASS: ZIP integrity, exact file list, package matches source, original files unchanged')
