'use strict';
const crypto = require('crypto');
const lz4 = require('lz4js');

const HEADER_SIZE = 1024;
const BODY_SIZE = 3097152;
const PC_SAVE_SIZE = HEADER_SIZE + BODY_SIZE;
const AES_KEY = Buffer.from('33393632373736373534353535383833', 'hex');

const OUTFIT_STRUCT_START = 0x0fdc10;
const OUTFIT_STRUCT_SIZE = 0x5c;
const PC_STRUCT_START = OUTFIT_STRUCT_START;
const SWITCH_STRUCT_START = OUTFIT_STRUCT_START + 4;
const MARKER_STRUCT_OFFSET = 60;
const GENDER_STRUCT_OFFSET = 64;
const GENDER_OFFSET = PC_STRUCT_START + GENDER_STRUCT_OFFSET;
const MODEL_DATA_START = 0x0fdd84;
const MODEL_DATA_SIZE = 28;
const APPEARANCE_BLOCK_START = 0x0fdebd;
const APPEARANCE_BLOCK_SIZE = 773;

function decryptPc(buf) {
  if (buf.length !== PC_SAVE_SIZE) {
    throw new Error(`PC save must be ${PC_SAVE_SIZE} bytes, got ${buf.length}`);
  }
  const decipher = crypto.createDecipheriv('aes-128-ecb', AES_KEY, null);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(buf), decipher.final()]);
}

function encryptPc(buf) {
  if (buf.length !== PC_SAVE_SIZE) {
    throw new Error(`PC save must be ${PC_SAVE_SIZE} bytes, got ${buf.length}`);
  }
  const cipher = crypto.createCipheriv('aes-128-ecb', AES_KEY, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(buf), cipher.final()]);
}

function compressBody(body) {
  if (body.length !== BODY_SIZE) {
    throw new Error(`body must be ${BODY_SIZE} bytes, got ${body.length}`);
  }
  const dst = new Uint8Array(lz4.compressBound(BODY_SIZE));
  const hashTable = new Uint32Array(1 << 16);
  const size = lz4.compressBlock(body, dst, 0, body.length, hashTable);
  if (!(size > 0)) throw new Error('LZ4 compression failed');
  return Buffer.from(dst.buffer, 0, size);
}

function decompressBody(payload) {
  const dst = new Uint8Array(BODY_SIZE);
  let written;
  try {
    written = lz4.decompressBlock(payload, dst, 0, payload.length, 0);
  } catch (err) {
    throw new Error(`LZ4 decompression failed: ${err.message}`);
  }
  if (written < BODY_SIZE) {
    throw new Error(`decompressed body is ${written} bytes, expected ${BODY_SIZE}`);
  }
  return Buffer.from(dst.buffer, 0, BODY_SIZE);
}


function headerText(header) {
  const nul = header.indexOf(0);
  const end = nul >= 0 ? nul : header.length;
  return header.subarray(0, end).toString('utf8');
}

// The textual 1024-byte header contains the playtime as its 6th CSV field.
// Keep the Switch template header (needed for Switch compatibility), but copy
// only the PC playtime field so the load screen retains the original hours.
function mergePcPlaytimeIntoSwitchHeader(pcHeader, switchHeader) {
  const pcText = headerText(pcHeader);
  const swText = headerText(switchHeader);
  const pcFields = pcText.split(',');
  const swFields = swText.split(',');
  if (pcFields.length < 6 || swFields.length < 6) {
    throw new Error('could not parse save header playtime field');
  }

  const pcPlaytime = pcFields[5].trim();
  if (!/^\d+(?:\.\d+)?$/.test(pcPlaytime)) {
    throw new Error(`unexpected PC playtime value in header: ${pcFields[5]}`);
  }

  swFields[5] = ` ${pcPlaytime}`;
  const mergedText = swFields.join(',');
  const encoded = Buffer.from(mergedText, 'utf8');
  if (encoded.length >= HEADER_SIZE) {
    throw new Error(`merged header is too large (${encoded.length} bytes)`);
  }

  // Preserve any non-text bytes from the Switch header, then overwrite the
  // textual prefix and terminate it cleanly with NUL.
  const merged = Buffer.from(switchHeader);
  merged.fill(0, 0, HEADER_SIZE);
  encoded.copy(merged, 0);
  merged[encoded.length] = 0;
  return merged;
}

function validateSwitchHeader(header) {
  const text = header.toString('latin1');
  const fields = text.split(',');
  const size = fields.length > 1 ? parseInt(fields[1].trim(), 10) : NaN;
  if (size !== BODY_SIZE) {
    throw new Error(`invalid Switch header (size field: ${fields[1] ? fields[1].trim() : 'missing'})`);
  }
}

function shiftOutfitStruct(body, direction) {
  const s = OUTFIT_STRUCT_START;
  const n = OUTFIT_STRUCT_SIZE;
  if (direction === 'pc-to-switch') {
    body.copyWithin(s + 4, s, s + n);
    body.fill(0, s, s + 4);
  } else if (direction === 'switch-to-pc') {
    body.copyWithin(s, s + 4, s + 4 + n);
    body.fill(0, s + n, s + n + 4);
  } else {
    throw new Error(`unknown direction: ${direction}`);
  }
}

function convertBody(body, direction) {
  if (direction !== 'pc-to-switch' && direction !== 'switch-to-pc') {
    throw new Error(`unknown direction: ${direction}`);
  }
  const sourceStructStart = direction === 'pc-to-switch' ? PC_STRUCT_START : SWITCH_STRUCT_START;
  const markerOffset = sourceStructStart + MARKER_STRUCT_OFFSET;
  const marker = body[markerOffset];
  if (marker !== 0 && marker !== 1) {
    throw new Error(`unexpected layout marker (${marker}) at 0x${markerOffset.toString(16).toUpperCase()} - save layout not recognized, aborting to avoid corrupting the save`);
  }
  shiftOutfitStruct(body, direction);
  if (direction === 'pc-to-switch') {
    body.fill(0, MODEL_DATA_START, MODEL_DATA_START + MODEL_DATA_SIZE);
    body.fill(0, APPEARANCE_BLOCK_START, APPEARANCE_BLOCK_START + APPEARANCE_BLOCK_SIZE);
  }
}

function pcToSwitch(pcFile, switchTemplateFile = null) {
  const plain = decryptPc(pcFile);
  let header;
  if (switchTemplateFile && switchTemplateFile.length >= HEADER_SIZE) {
    const switchHeader = Buffer.from(switchTemplateFile.subarray(0, HEADER_SIZE));
    validateSwitchHeader(switchHeader);
    header = mergePcPlaytimeIntoSwitchHeader(plain.subarray(0, HEADER_SIZE), switchHeader);
  } else {
    header = Buffer.from(plain.subarray(0, HEADER_SIZE));
  }
  const body = Buffer.from(plain.subarray(HEADER_SIZE));
  convertBody(body, 'pc-to-switch');
  return Buffer.concat([header, compressBody(body)]);
}

function switchToPc(switchFile) {
  if (switchFile.length <= HEADER_SIZE) {
    throw new Error(`file too short (${switchFile.length} bytes)`);
  }
  const header = switchFile.subarray(0, HEADER_SIZE);
  validateSwitchHeader(header);
  const body = decompressBody(switchFile.subarray(HEADER_SIZE));
  convertBody(body, 'switch-to-pc');
  return encryptPc(Buffer.concat([header, body]));
}

module.exports = {
  HEADER_SIZE, BODY_SIZE, PC_SAVE_SIZE,
  OUTFIT_STRUCT_START, OUTFIT_STRUCT_SIZE, GENDER_OFFSET,
  PC_STRUCT_START, SWITCH_STRUCT_START, MARKER_STRUCT_OFFSET, GENDER_STRUCT_OFFSET,
  MODEL_DATA_START, MODEL_DATA_SIZE,
  APPEARANCE_BLOCK_START, APPEARANCE_BLOCK_SIZE,
  decryptPc, encryptPc, compressBody, decompressBody, validateSwitchHeader, mergePcPlaytimeIntoSwitchHeader,
  convertBody, pcToSwitch, switchToPc,
};
