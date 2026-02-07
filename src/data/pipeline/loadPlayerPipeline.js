import { loadDataset } from '../loadDataset.js';
import { buildPlayerPipeline } from './buildPlayerPipeline.js';

export const loadPlayerPipeline = async (options = {}) => {
  const datasetSummary = await loadDataset(options);
  const pipeline = buildPlayerPipeline(datasetSummary.datasetBySource);

  return {
    ...datasetSummary,
    pipeline: {
      players: pipeline.players,
      starters: pipeline.starters,
      depthChart: pipeline.depthChart,
      metrics: pipeline.metrics,
      coverage: pipeline.coverage
    }
  };
};
