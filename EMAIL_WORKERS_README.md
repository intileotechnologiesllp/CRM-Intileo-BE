# Email Queue Workers - PM2 Management Scripts

## Quick Start Commands

### Start all workers separately (recommended)

```bash
pm2 start ecosystem.config.js
```

### Start individual worker types

```bash
# Start only inbox workers
pm2 start ecosystem.config.js --only email-inbox-workers

# Start only cron workers
pm2 start ecosystem.config.js --only email-cron-workers

# Start only sync/email workers
pm2 start ecosystem.config.js --only email-sync-workers
```

### Monitor workers

```bash
# View all processes
pm2 list

# View logs for specific worker
pm2 logs email-inbox-workers
pm2 logs email-cron-workers
pm2 logs email-sync-workers

# View all logs
pm2 logs

# Monitor real-time
pm2 monit
```

### Control workers

```bash
# Restart specific worker
pm2 restart email-inbox-workers
pm2 restart email-cron-workers

# Restart all workers
pm2 restart ecosystem.config.js

# Stop workers
pm2 stop email-inbox-workers
pm2 stop ecosystem.config.js

# Delete workers
pm2 delete email-inbox-workers
pm2 delete ecosystem.config.js
```

### Direct execution (for testing)

```bash
# Test inbox workers only
node utils/emailQueueWorker.js --inbox

# Test cron workers only
node utils/emailQueueWorker.js --cron

# Test sync workers only
node utils/emailQueueWorker.js --sync

# Test all workers together (not recommended for production)
node utils/emailQueueWorker.js --all
```

## Worker Types

- **email-inbox-workers**: Handles `FETCH_INBOX_QUEUE_{userID}` queues for batch email fetching
- **email-cron-workers**: Handles `email-fetch-queue-{userID}` queues for scheduled email fetching
- **email-sync-workers**: Handles sync, outgoing email, and scheduled email queues

## Benefits of Separate Processes

1. **Isolation**: Each worker type runs in its own process with isolated memory
2. **Reliability**: If one worker crashes, others continue running
3. **Monitoring**: Easy to monitor each worker type separately
4. **Scaling**: Can scale each worker type independently
5. **Resource Management**: Better memory and CPU resource management

## Configuration

Edit `ecosystem.config.js` to modify:

- Memory limits (`max_memory_restart`)
- Log file locations
- Environment variables
- Restart policies

## Logs

All logs are saved to the `./logs/` directory:

- `email-inbox-workers.log` - Combined logs for inbox workers
- `email-cron-workers.log` - Combined logs for cron workers
- `email-sync-workers.log` - Combined logs for sync workers
- Separate error and output files for each worker type
