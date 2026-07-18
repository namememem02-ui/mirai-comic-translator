const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(projectRoot, 'src/index.html'), 'utf8');
const css = fs.readFileSync(path.join(projectRoot, 'src/style.css'), 'utf8');
const renderer = fs.readFileSync(path.join(projectRoot, 'src/index.js'), 'utf8');
const main = fs.readFileSync(path.join(projectRoot, 'main.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const backupSource = fs.readFileSync(path.join(projectRoot, 'lib/project-backup.js'), 'utf8');

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

test('public Mee-a-rai name and semantic brand structure are integrated exactly once', () => {
  assert.match(html, /<title>Mee-a-rai Comic Translator<\/title>/);
  assert.equal(count(html, /id="meeARaiBrand"/g), 1);
  assert.equal(count(html, /id="meeARaiBrandToggle"/g), 1);
  assert.match(html, /<button[^>]*id="meeARaiBrandToggle"[^>]*aria-expanded="false"[^>]*>[\s\S]*>M<[\s\S]*<\/button>/);
  assert.equal(count(html, /class="app-title">Comic Translator<\/h1>/g), 1);
  assert.match(main, /title:\s*['"]Mee-a-rai Comic Translator['"]/);
  assert.equal(packageJson.description.startsWith('Mee-a-rai Comic Translator'), true);
  assert.doesNotMatch(html, /Comic Translator\s+เธกเธตเธญเธฐ/);
});

test('brand module loads before the renderer and initializes with cleanup once', () => {
  assert.ok(fs.existsSync(path.join(projectRoot, 'src/mee-a-rai-brand.js')));
  const modulePosition = html.indexOf('<script src="mee-a-rai-brand.js"></script>');
  const rendererPosition = html.indexOf('<script src="index.js"></script>');
  assert.ok(modulePosition >= 0 && modulePosition < rendererPosition);
  assert.equal(count(renderer, /MeeARaiBrand\.initMeeARaiBrand\(document\)/g), 1);
  assert.match(renderer, /beforeunload[\s\S]*\.destroy\(\)/);
});

test('brand CSS fixes the mark at 39px idle and 166px expanded without responsive overrides', () => {
  assert.match(css, /--brand-purple:\s*#a78bfa/);
  assert.match(css, /--brand-purple-quiet:\s*rgba\(139,\s*92,\s*246,/);
  assert.match(css, /\.mee-a-rai-brand__mark\s*\{[^}]*width:\s*39px[^}]*flex-shrink:\s*0/s);
  assert.match(css, /\.mee-a-rai-brand\.is-expanded\s+\.mee-a-rai-brand__mark\s*\{[^}]*width:\s*166px/s);
  assert.match(css, /\.mee-a-rai-brand__trigger\s*\{[^}]*width:\s*39px[^}]*min-width:\s*39px[^}]*min-height:\s*(?:35|39)px[^}]*border:\s*0\s*!important/s);
  assert.match(css, /\.mee-a-rai-brand__mark\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.mee-a-rai-brand\s+\.app-title\s*\{[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.mee-a-rai-brand__trigger:focus-visible\s*\{[^}]*outline:/s);
  assert.equal(count(css, /\.mee-a-rai-brand__mark/g), 2, 'mark size must not be redefined in media queries');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.mee-a-rai-brand__extension[\s\S]*transition:\s*none/s);
});

test('branding leaves storage, backup, package, and project/output identifiers intact', () => {
  assert.equal(packageJson.name, 'comic-translator');
  assert.match(backupSource, /mirai-comictranslator-backup/);
  assert.match(main, /path\.join\(__dirname,\s*['"]projects['"]\)/);
  assert.match(main, /path\.join\(__dirname,\s*['"]output['"]\)/);
  assert.match(main, /['"]app_settings\.json['"]/);
  assert.match(main, /['"]projects_map\.json['"]/);
  assert.match(main, /['"]last_project\.json['"]/);
});
