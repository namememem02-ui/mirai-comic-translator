const JPEG_PREFIX = 'data:image/jpeg;base64,';
const JSZip = require('jszip');

function sanitizeArchiveName(input) {
  let name = String(input || '').trim().replace(/[\\/:*?"<>|]/g, '');
  name = name.replace(/[. ]+$/g, '').trim();
  if (!name) name = 'facebook-export';
  if (!name.toLowerCase().endsWith('.zip')) name += '.zip';
  return name;
}

function decodeJpegDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(JPEG_PREFIX)) {
    throw new TypeError('Expected a JPEG data URL');
  }
  const payload = dataUrl.slice(JPEG_PREFIX.length);
  if (!payload) throw new TypeError('JPEG data URL is empty');
  return Buffer.from(payload, 'base64');
}

function validateArchiveFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new TypeError('Archive requires at least one JPEG file');
  }
  return files.map(file => {
    if (!file || !/^\d{3,}\.jpg$/.test(file.name)) {
      throw new TypeError('Invalid Facebook export filename');
    }
    return { name: file.name, buffer: decodeJpegDataUrl(file.dataUrl) };
  });
}

async function createArchiveBuffer(files) {
  const validatedFiles = validateArchiveFiles(files);
  const zip = new JSZip();
  for (const file of validatedFiles) zip.file(file.name, file.buffer);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = {
  sanitizeArchiveName,
  decodeJpegDataUrl,
  validateArchiveFiles,
  createArchiveBuffer
};
