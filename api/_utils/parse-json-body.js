const MAX_LOGIN_BODY_BYTES = 16 * 1024;

export async function parseJsonBody(request) {
  const existing = request.body;
  if (existing && typeof existing === 'object' && !Buffer.isBuffer(existing)
      && typeof existing.getReader !== 'function'
      && typeof existing[Symbol.asyncIterator] !== 'function') return existing;

  let raw = '';
  if (typeof existing === 'string') raw = existing;
  else if (Buffer.isBuffer(existing) || existing instanceof Uint8Array) raw = Buffer.from(existing).toString('utf8');
  else if (existing && typeof existing.getReader === 'function') {
    const reader = existing.getReader();
    const chunks = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const buffer = Buffer.from(value);
        length += buffer.length;
        if (length > MAX_LOGIN_BODY_BYTES) throw new Error('Request body is too large.');
        chunks.push(buffer);
      }
    } finally {
      reader.releaseLock();
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  else {
    const source = existing && typeof existing[Symbol.asyncIterator] === 'function' ? existing : request;
    const chunks = [];
    let length = 0;
    for await (const chunk of source) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += buffer.length;
      if (length > MAX_LOGIN_BODY_BYTES) throw new Error('Request body is too large.');
      chunks.push(buffer);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_LOGIN_BODY_BYTES) throw new Error('Request body is too large.');
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid JSON object.');
  return parsed;
}
