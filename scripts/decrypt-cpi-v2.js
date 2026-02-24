const fs = require('fs');
const DES = require('des.js');

// פונקציה להתאמת סיביות זוגיות
function adjustDESParity(key) {
  const adjusted = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    let b = key[i] & 0x7F;
    let t = b;
    t ^= (t << 4);
    t ^= (t << 2);
    t ^= (t << 1);
    adjusted[i] = b | ((~t) & 0x80);
  }
  return adjusted;
}

// פענוח DES-CBC ידני
function decryptDES_CBC(encrypted, keyBuf, ivBuf) {
  const des = new DES({ type: 'des', key: Array.from(keyBuf) });
  const decrypted = Buffer.alloc(encrypted.length);

  let prevBlock = ivBuf;

  for (let i = 0; i < encrypted.length; i += 8) {
    const block = encrypted.slice(i, i + 8);
    const decryptedBlock = Buffer.from(des.decrypt(Array.from(block)));

    // XOR עם הבלוק הקודם (CBC)
    for (let j = 0; j < 8; j++) {
      decrypted[i + j] = decryptedBlock[j] ^ prevBlock[j];
    }

    prevBlock = block;
  }

  return decrypted;
}

// הסרת ריפוד
function removeYamahaPadding(data) {
  if (data.length === 0) return data;
  const lastByte = data[data.length - 1];
  const remainder = lastByte;

  if (remainder > 0 && remainder < 8) {
    const blockStart = data.length - 8;
    const actualDataInLastBlock = remainder;
    return data.slice(0, blockStart + actualDataInLastBlock);
  }

  return data;
}

// פענוח קובץ CPI
function decryptCPI(inputPath, outputPath) {
  console.log('קורא קובץ CPI...');
  const data = fs.readFileSync(inputPath);

  let offset = 0;

  // XPIH
  offset += 4; // tag
  const xpihSize = data.readUInt32BE(offset);
  offset += 4;
  console.log(`XPIH: ${xpihSize} בתים`);

  offset += xpihSize;

  // CSEC
  offset += 4; // tag
  const csecSize = data.readUInt32BE(offset);
  offset += 4;
  console.log(`CSEC: ${csecSize} בתים`);

  const csecData = data.slice(offset, offset + csecSize);
  offset += csecSize;

  // Payload
  const encryptedPayload = data.slice(offset);
  console.log(`Payload: ${encryptedPayload.length} בתים`);

  // מפתח
  const keyString = "Foatfkio";
  const keyRaw = Buffer.from(keyString, 'ascii');
  const key = adjustDESParity(keyRaw);
  const iv = Buffer.alloc(8, 0);

  console.log(`\nמפתח: ${key.toString('hex')}`);

  // פענוח CSEC
  console.log('\n=== פענוח CSEC ===');
  try {
    const decCSEC = decryptDES_CBC(csecData, key, iv);
    console.log(decCSEC.toString('hex').match(/.{1,32}/g).join('\n'));
    console.log('\nASCII:', decCSEC.toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
  } catch (e) {
    console.error('שגיאה בפענוח CSEC:', e.message);
  }

  // פענוח Payload (רק 10KB ראשונים לבדיקה)
  console.log('\n=== פענוח Payload (10KB ראשונים) ===');
  const payloadSample = encryptedPayload.slice(0, 10240);

  try {
    const decPayload = decryptDES_CBC(payloadSample, key, iv);

    // חיפוש המספר
    const searchStr = 'E1GC3617273';
    const idx = decPayload.indexOf(searchStr);

    if (idx >= 0) {
      console.log(`\n✓✓✓ נמצא "${searchStr}" ב-offset ${idx} (0x${idx.toString(16)}) ✓✓✓`);
      const context = decPayload.slice(Math.max(0, idx - 50), idx + 50);
      console.log('\nהקשר:');
      console.log(context.toString('hex').match(/.{1,32}/g).join('\n'));
      console.log('\nASCII:');
      console.log(context.toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
    } else {
      console.log(`\n✗ לא נמצא "${searchStr}"`);
    }

    // הצגת תחילת הPayload
    console.log('\n=== 512 בתים ראשונים ===');
    const preview = decPayload.slice(0, 512);
    for (let i = 0; i < preview.length; i += 16) {
      const chunk = preview.slice(i, Math.min(i + 16, preview.length));
      const hex = chunk.toString('hex').match(/.{1,2}/g).join(' ');
      const ascii = chunk.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
      console.log(`${i.toString(16).padStart(4, '0')}: ${hex.padEnd(48, ' ')}  ${ascii}`);
    }

  } catch (e) {
    console.error('שגיאה בפענוח Payload:', e.message);
    console.error(e.stack);
  }
}

// הרצה
const inputFile = process.argv[2] || 'C:\\Users\\shalom\\Downloads\\61455V5.cpi';
const outputFile = process.argv[3] || 'C:\\Users\\shalom\\Downloads\\61455V5_decrypted.bin';

try {
  decryptCPI(inputFile, outputFile);
} catch (error) {
  console.error('שגיאה:', error.message);
  console.error(error.stack);
  process.exit(1);
}
