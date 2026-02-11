import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectAllTeams } from '../src/data/collection/teamCollectionOrchestrator.js';
import { resolveTeam } from '../src/data/teamConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputRoot = path.join(rootDir, 'src', 'data', 'collected');

const writeJson = async (filepath, value) => {
  await mkdir(path.dirname(filepath), { recursive: true });
  await writeFile(filepath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const results = await collectAllTeams({
  teams: ['Miami Hurricanes', 'Alabama Crimson Tide'],
  season: 2026
});

for (const result of results) {
  const team = resolveTeam(result.team);
  const teamDir = path.join(outputRoot, team.id);
  await mkdir(teamDir, { recursive: true });

  await Promise.all(
    Object.entries(result.datasetBySource).map(([sourceType, dataset]) =>
      writeJson(path.join(teamDir, `${sourceType}.json`), dataset)
    )
  );

  await writeJson(path.join(teamDir, 'manifest.json'), {
    team: team.label,
    season: result.season,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    sourceStatus: result.sourceStatus
  });
}

console.log(`Scaffold collection completed for ${results.length} teams.`);
for (const result of results) {
  console.log(`- ${result.team}: ${Object.keys(result.datasetBySource).join(', ')}`);
}

