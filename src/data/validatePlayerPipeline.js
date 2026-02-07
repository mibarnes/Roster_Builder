import { loadPlayerPipeline } from './pipeline/loadPlayerPipeline.js';

const mode = process.env.DATA_MODE ?? process.env.VITE_DATA_MODE ?? 'mock';
const summary = await loadPlayerPipeline({ mode });
const { pipeline } = summary;

console.log(`Mode: ${summary.mode}`);
console.log(`Players in pipeline: ${pipeline.players.length}`);
console.log(
  `Coverage: recruiting=${pipeline.coverage.recruitingMatched}/${pipeline.coverage.rosterCount}, ratings=${pipeline.coverage.ratingsMatched}/${pipeline.coverage.rosterCount}, production=${pipeline.coverage.productionMatched}/${pipeline.coverage.rosterCount}`
);
console.log(
  `Starter metrics: teamComposite=${pipeline.metrics.team.avgStarterComposite ?? 'n/a'}, offenseComposite=${pipeline.metrics.offense.avgStarterComposite ?? 'n/a'}, defenseComposite=${pipeline.metrics.defense.avgStarterComposite ?? 'n/a'}, teamOverall=${pipeline.metrics.team.avgStarterOverall ?? 'n/a'}`
);

const issues = [];
if (pipeline.players.length === 0) {
  issues.push('Pipeline returned zero players');
}

if (pipeline.coverage.recruitingMatched !== pipeline.coverage.rosterCount) {
  issues.push('Recruiting coverage does not match roster count');
}
if (pipeline.coverage.ratingsMatched !== pipeline.coverage.rosterCount) {
  issues.push('Ratings coverage does not match roster count');
}
if (pipeline.coverage.productionMatched !== pipeline.coverage.rosterCount) {
  issues.push('Production coverage does not match roster count');
}

if (summary.warnings?.length) {
  for (const warning of summary.warnings) {
    console.log(`Warning: ${warning}`);
  }
}

if (issues.length) {
  for (const issue of issues) {
    console.error(`ERROR: ${issue}`);
  }
  process.exitCode = 1;
}
