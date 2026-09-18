import * as fontkit from 'fontkit';
for (const f of ['assets/fonts/NotoSansDevanagari-Regular.ttf','assets/fonts/NotoSansSC-Regular.ttf']) {
  const font = fontkit.openSync(f);
  const checks = { 'A': 0x41, 'a': 0x61, '0': 0x30, 'अ': 0x905, '中': 0x4E2D, '₹': 0x20B9 };
  const res = Object.entries(checks).map(([k,v]) => `${k}:${font.hasGlyphForCodePoint(v)}`).join(' ');
  console.log(f.split('/').pop(), '→', res);
}
