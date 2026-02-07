import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerPipeline } from './buildPlayerPipeline.js';

const datasetBySource = {
  roster: {
    players: [
      { playerId: 'p1', name: 'Alex One', number: 1, side: 'OFFENSE', position: 'QB', classYear: 'JR', height: "6'2\"", weight: 210, eligibilityRemaining: 2, isTransfer: false },
      { playerId: 'p2', name: 'Blake Two', number: 2, side: 'DEFENSE', position: 'CB', classYear: 'SO', height: "6'0\"", weight: 190, eligibilityRemaining: 3, isTransfer: true }
    ],
    depthChart: { offense: { QB: 'p1' }, defense: { CB1: 'p2' } }
  },
  recruiting: { playerRecruitProfiles: [{ playerId: 'p1', stars: 4, compositeRating: 0.95 }, { playerId: 'p2', stars: 3, transferPortalStars: 4, compositeRating: 0.9 }] },
  ratings: { playerRatings: [{ playerId: 'p1', overall: 90 }, { playerId: 'p2', overall: 88 }] },
  production: { season: 2025, playerProduction: [{ playerId: 'p1', passingYards: 2500 }, { playerId: 'p2', tackles: 55 }] }
};

test('buildPlayerPipeline builds players, coverage and starter metrics', () => {
  const pipeline = buildPlayerPipeline(datasetBySource);
  assert.equal(pipeline.players.length, 2);
  assert.equal(pipeline.coverage.rosterCount, 2);
  assert.equal(pipeline.coverage.recruitingMatched, 2);
  assert.equal(pipeline.metrics.team.starterCount, 2);
  assert.equal(pipeline.metrics.team.avgStarterComposite, 92.5);
  assert.equal(pipeline.depthChart.offense[0].slot, 'QB');
});
