const DES = require('des.js');
const fs = require('fs');

// פונקציה להתאמת סיביות זוגיות (Parity Bit Adjustment)
function adjustDESParity(key) {
  const adjusted = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    let b = key[i] & 0x7F; // 7 סיביות תחתונות
    let t = b;
    t ^= (t << 4);
    t ^= (t << 2);
    t ^= (t << 1);
    adjusted[i] = b | ((~t) & 0x80); // קביעת MSB
  }
  return adjusted;
}

// פענוח DES-CBC
function decryptDES_CBC(encrypted, key, iv) {
  const des = DES.create({
    type: 'des-cbc',
    key: Array.from(key),
    iv: Array.from(iv)
  });

  const decrypted = Buffer.from(des.update(Array.from(encrypted), 'hex', 'hex'), 'hex');
  return decrypted;
}

// הסרת ריפוד ימאהה
function removeYamahaPadding(data) {
  if (data.length === 0) return data;
  const lastByte = data[data.length - 1];
  const remainder = lastByte;

  // אם remainder תקין (1-7), זה אומר שיש ריפוד
  if (remainder > 0 && remainder < 8) {
    const blockStart = data.length - 8;
    const actualDataInLastBlock = remainder;
    return data.slice(0, blockStart + actualDataInLastBlock);
  }

  return data;
}

// קריאת קובץ CPI ופענוח
function decryptCPI(inputPath, outputPath) {
  console.log('קורא קובץ CPI...');
  const data = fs.readFileSync(inputPath);

  let offset = 0;

  // קריאת XPIH header
  const xpihTag = data.toString('ascii', offset, offset + 4);
  offset += 4;
  const xpihSize = data.readUInt32BE(offset);
  offset += 4;
  console.log(`XPIH: גודל=${xpihSize}`);

  const xpihEnd = offset + xpihSize;

  // דילוג על XMDL ו-XPID (לא מוצפנים)
  offset = xpihEnd;

  // קריאת CSEC
  const csecTag = data.toString('ascii', offset, offset + 4);
  offset += 4;
  const csecSize = data.readUInt32BE(offset);
  offset += 4;
  console.log(`CSEC: גודל=${csecSize}`);

  const csecData = data.slice(offset, offset + csecSize);
  offset += csecSize;

  // שאר הנתונים = Payload מוצפן
  const encryptedPayload = data.slice(offset);
  console.log(`Payload מוצפן: ${encryptedPayload.length} בתים`);

  // הכנת מפתח
  const keyString = "Foatfkio";
  const keyRaw = Buffer.from(keyString, 'ascii');
  const key = adjustDESParity(keyRaw);
  const iv = Buffer.alloc(8, 0); // 8 בתי אפס

  console.log(`מפתח מקורי: ${keyRaw.toString('hex')}`);
  console.log(`מפתח מותאם: ${key.toString('hex')}`);
  console.log(`IV: ${iv.toString('hex')}`);

  // פענוח CSEC
  console.log('\nמפענח CSEC...');
  const decryptedCSEC = decryptDES_CBC(csecData, key, iv);
  console.log('CSEC מפוענח (hex):');
  console.log(decryptedCSEC.toString('hex'));
  console.log('CSEC מפוענח (ascii):');
  console.log(decryptedCSEC.toString('ascii').replace(/[^\x20-\x7E]/g, '.'));

  // פענוח Payload
  console.log('\nמפענח Payload...');
  const decryptedPayload = decryptDES_CBC(encryptedPayload, key, iv);
  const cleanPayload = removeYamahaPadding(decryptedPayload);

  console.log(`Payload מפוענח: ${cleanPayload.length} בתים`);

  // חיפוש המספר הסידורי
  console.log('\nמחפש מספר סידורי E1GC3617273...');
  const searchStr = 'E1GC3617273';
  const searchBuf = Buffer.from(searchStr, 'ascii');

  let found = false;
  for (let i = 0; i < cleanPayload.length - searchBuf.length; i++) {
    if (cleanPayload.slice(i, i + searchBuf.length).equals(searchBuf)) {
      console.log(`✓ נמצא ב-offset 0x${i.toString(16)} (${i})`);
      console.log(`  הקשר (50 בתים):`, cleanPayload.slice(Math.max(0, i - 25), i + 25).toString('hex'));
      found = true;
    }
  }

  if (!found) {
    console.log('✗ לא נמצא בפורמט ASCII');
    console.log('\nמחפש את הספרות בנפרד...');
    // חיפוש 3339 (prefix מקובץ האינפו)
    const idx3339 = cleanPayload.indexOf('3339');
    if (idx3339 >= 0) {
      console.log(`✓ נמצא "3339" ב-offset 0x${idx3339.toString(16)}`);
    }
  }

  // שמירת הפלט
  fs.writeFileSync(outputPath, cleanPayload);
  console.log(`\n✓ נתונים מפוענחים נשמרו ל: ${outputPath}`);

  // הצגת 1024 בתים ראשונים
  console.log('\n=== 1024 בתים ראשונים של Payload מפוענח ===');
  const preview = cleanPayload.slice(0, Math.min(1024, cleanPayload.length));

  // Hex dump
  for (let i = 0; i < preview.length; i += 16) {
    const chunk = preview.slice(i, Math.min(i + 16, preview.length));
    const hex = chunk.toString('hex').match(/.{1,2}/g).join(' ');
    const ascii = chunk.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
    console.log(`${i.toString(16).padStart(8, '0')}: ${hex.padEnd(48, ' ')}  ${ascii}`);
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
