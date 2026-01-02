const CampaignWorker = require('./workers/campaignWorker');

// Start campaign worker
const worker = new CampaignWorker({
  concurrency: 3,
  prefetch: 5,
  workerName: `campaign-worker-${process.pid}`
});

worker.start().catch(error => {
  console.error('Failed to start campaign worker:', error);
  process.exit(1);
});

