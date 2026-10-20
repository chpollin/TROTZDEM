import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./swarm.js', import.meta.url), 'utf8');
const { drawSwarm } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function frame(t, strength, options) {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, key) => (...args) => {
      for (const value of args) if (typeof value === 'number') assert(Number.isFinite(value), `${key} emitted invalid coordinate`);
      calls.push([key, ...args]);
    },
    set: (_, key, value) => { calls.push(['set', key, value]); return true; },
  });
  drawSwarm(ctx, t, strength, options);
  return calls;
}
const reference = frame(20, 0.9);
frame(8, 0.15);
frame(22, 1);
assert.deepEqual(frame(20, 0.9), reference, 'Out-of-order rendering must preserve exact draw commands');
assert.notDeepEqual(frame(19, 0.9), reference, 'Absolute clock must actually animate the swarm');
assert.equal(frame(20, 0).length, 0, 'Absent swarm must not alter caller context');
for (const time of [-1000, 0, 7, 14, 18, 20, 24, 1000]) {
  for (const strength of [0.001, 0.2, 0.6, 1]) frame(time, strength);
}
assert.throws(() => frame(NaN, 0.5), TypeError);
assert.throws(() => frame(20, 0.5, { x: Infinity }), TypeError);
console.log('PASS: out-of-order deterministic draw commands; finite boundary geometry; inactive swarm/context preservation; invalid-input rejection.');
