// Generic OFX (SGML) statement parser. Reads <STMTTRN> blocks.
// Tags read: TRNTYPE, DTPOSTED (YYYYMMDD or YYYYMMDDHHMMSS), TRNAMT (signed), MEMO, NAME, FITID.

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, 'i'));
  return m ? m[1].trim() : '';
}

function parseOfxDate(s) {
  if (!s) return new Date().toISOString();
  const y = s.substring(0, 4), mo = s.substring(4, 6), d = s.substring(6, 8);
  return new Date(parseInt(y), parseInt(mo) - 1, parseInt(d)).toISOString();
}

export function parseOfx(text) {
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  const out = [];
  for (const b of blocks) {
    const amountStr = tag(b, 'TRNAMT');
    const amount = parseFloat(amountStr);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const memo = tag(b, 'MEMO') || tag(b, 'NAME') || tag(b, 'TRNTYPE');
    if (!memo) continue;
    out.push({
      date: parseOfxDate(tag(b, 'DTPOSTED')),
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      description: memo,
      originalId: tag(b, 'FITID'),
    });
  }
  return out;
}

export function detectOfx(text) {
  return /<OFX>/i.test(text) || /OFXHEADER:/i.test(text);
}
