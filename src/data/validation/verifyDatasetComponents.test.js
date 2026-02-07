import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyDatasetComponents } from './verifyDatasetComponents.js';

test('verifyDatasetComponents flags missing and empty components', () => {
  const result = verifyDatasetComponents(
    { roster: { players: [] } },
    ['roster.players', 'ratings.playerRatings', 'recruiting.playerRecruitProfiles']
  );

  assert.equal(result.isComplete, false);
  assert.deepEqual(result.emptyComponents, ['roster.players']);
  assert.deepEqual(result.missingComponents, ['ratings.playerRatings', 'recruiting.playerRecruitProfiles']);
});
