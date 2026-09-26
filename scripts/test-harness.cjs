// Node 测试引导：提供浏览器环境垫片
const nodeCrypto = require('node:crypto');

// localStorage 垫片
class LocalStorageMock {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.has(k) ? this.store.get(k) : null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
  key(i) { return Array.from(this.store.keys())[i] ?? null; }
  get length() { return this.store.size; }
}
globalThis.localStorage = new LocalStorageMock();

// crypto.subtle 垫片（Node 20 已提供 webcrypto，双保险）
if (!globalThis.crypto) globalThis.crypto = nodeCrypto.webcrypto;
if (!globalThis.crypto.subtle) globalThis.crypto = nodeCrypto.webcrypto;

require('./.test-bundle.cjs');
