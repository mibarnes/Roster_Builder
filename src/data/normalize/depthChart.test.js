import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDepthChart } from './depthChart.js';

test('normalizeDepthChart normalizes offense WR aliases and preserves canonical defense slots', () => {
  const normalized = normalizeDepthChart({
    offense: { WRX: 'a1', WRZ: 'a2', SLOT: 'a3' },
    defense: { LDE: 'd1', RDE: 'd2', SS: 's1' }
  });

  assert.equal(normalized.offense.WR1, 'a1');
  assert.equal(normalized.offense.WR2, 'a2');
  assert.equal(normalized.offense.WR3, 'a3');
  assert.equal(normalized.defense.LDE, 'd1');
  assert.equal(normalized.defense.RDE, 'd2');
  assert.equal(normalized.defense.SS, 's1');
  assert.deepEqual(normalized.slotMetadata.wrCanonical, ['WR1', 'WR2', 'WR3']);
});
