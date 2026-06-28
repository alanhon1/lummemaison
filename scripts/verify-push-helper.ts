// scripts/verify-push-helper.ts — run: npx tsx scripts/verify-push-helper.ts
import assert from 'node:assert/strict';
import { urlBase64ToUint8Array } from '../components/pwa/pushClient';

// "AQID" base64url decodes to bytes [1,2,3]
const out = urlBase64ToUint8Array('AQID');
assert.deepEqual(Array.from(out), [1, 2, 3]);
// padding + url-safe chars (- _) must not throw and must round-trip length
const k = urlBase64ToUint8Array('BNcRd-_h'.padEnd(12, 'A'));
assert.ok(k instanceof Uint8Array && k.length > 0);
console.log('✓ verify-push-helper: passed');
