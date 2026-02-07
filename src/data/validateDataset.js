import { loadDataset } from './index.js';

const mode = process.env.DATA_MODE ?? process.env.VITE_DATA_MODE ?? 'mock';
const summary = await loadDataset({ mode });

console.log(`Mode: ${summary.mode}`);
if (summary.warnings?.length) {
  console.log('Warnings:');
  summary.warnings.forEach((warning) => console.log(`- ${warning}`));
}

for (const item of summary.completenessReport.availability) {
  const countText = item.count === undefined ? '' : ` (count=${item.count})`;
  const emptyText = item.nonEmpty === false ? ' [EMPTY]' : '';
  console.log(`- ${item.available ? 'OK' : 'MISSING'} ${item.component}${countText}${emptyText}`);
}

if (!summary.completenessReport.isComplete) {
  process.exitCode = 1;
}
