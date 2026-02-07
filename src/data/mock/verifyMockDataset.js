import { mockDatasetBySource, verifyMockDatasetComponents } from './index.js';

const summary = verifyMockDatasetComponents();

console.log('Mock sources:', Object.keys(mockDatasetBySource).join(', '));
for (const item of summary.availability) {
  const countText = item.count === undefined ? '' : ` (count=${item.count})`;
  console.log(`- ${item.available ? 'OK' : 'MISSING'} ${item.component}${countText}`);
}

if (!summary.allAvailable) {
  process.exitCode = 1;
}
