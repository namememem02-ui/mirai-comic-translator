const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'sidecar', 'inpaint_server.py'),
  'utf8'
);

test('LaMa processes the complete image and mask without patch cropping', () => {
  assert.match(source, /result_pil\s*=\s*lama\(img_pil,\s*mask_pil\)/);
  assert.doesNotMatch(source, /findContours|boundingRect|crop_img|crop_mask|result_np\[y1:y2/);
});
