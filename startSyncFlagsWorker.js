#!/usr/bin/env node

/**
 * 🚀 PRODUCTION ARCHITECTURE: Flag Sync Worker Startup Script
 * 
 * This script starts individual flag sync workers that process IMAP flag
 * synchronization jobs from the SYNC_FLAGS_QUEUE.
 * 
 * Usage:
 *   node startSyncFlagsWorker.js [options]
 * 
 * Options:
 *   --concurrency=N    Max concurrent IMAP connections (default: 2)
 *   --prefetch=N       RabbitMQ prefetch count (default: 5)
 *   --name=NAME        Worker name (default: auto-generated)
 * 
 * Example:
 *   node startSyncFlagsWorker.js --concurrency=3 --prefetch=10 --name=worker-1
 */

const FlagSyncWorker = require('./workers/flagSyncWorker');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

args.forEach(arg => {
  if (arg.startsWith('--concurrency=')) {
    options.concurrency = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--prefetch=')) {
    options.prefetch = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--name=')) {
    options.workerName = arg.split('=')[1];
  }
});

// Set defaults
options.concurrency = options.concurrency || 2;
options.prefetch = options.prefetch || 5;
options.workerName = options.workerName || `flag-sync-worker-${process.pid}`;

console.log('🚀 Starting Flag Sync Worker with options:', options);

// Create and start worker
const worker = new FlagSyncWorker(options);

async function startWorker() {
  try {
    await worker.start();
    
    // Log worker stats every 60 seconds
    setInterval(() => {
      const stats = worker.getStats();
      console.log(`📊 [${stats.workerName}] Stats: Processed=${stats.processedJobs}, Failed=${stats.failedJobs}, Active=${stats.activeConnections}, Uptime=${Math.floor(stats.uptime)}s`);
    }, 60000);
    
  } catch (error) {
    console.error('❌ Failed to start flag sync worker:', error.message);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the worker
startWorker();