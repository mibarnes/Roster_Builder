import test from 'node:test';
import assert from 'node:assert/strict';
import { getClassColor, getEffectiveStars } from './playerHelpers.js';

test('getEffectiveStars uses transfer stars for transfer players', () => {
  assert.equal(getEffectiveStars({ stars: 3, isTransfer: true, transferStars: 4 }), 4);
});

test('getEffectiveStars falls back to standard stars for non-transfers', () => {
  assert.equal(getEffectiveStars({ stars: 3, isTransfer: false, transferStars: 5 }), 3);
});

test('getClassColor returns expected values', () => {
  assert.equal(getClassColor('FR'), '#4ade80');
  assert.equal(getClassColor('SO'), '#60a5fa');
});
