const amqp = require('amqplib');
const pLimit = require('p-limit');

// 🚀 PRODUCTION ARCHITECTURE: Flag Sync Queue Service
// Handles background IMAP flag synchronization using RabbitMQ

class FlagSyncQueueService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isInitialized = false;
    
    // Concurrency control for queue publishing
    this.publishLimit = pLimit(10); // Max 10 concurrent queue publications
  }

  // Initialize RabbitMQ connection
  async initialize() {
    try {
      if (this.isInitialized) return;
      
      console.log('🔌 [FLAG SYNC QUEUE] Initializing RabbitMQ connection...');
      this.connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
      // Attach connection-level handlers to avoid unhandled events
      this.connection.on('error', (err) => {
        console.error('❌ [FLAG SYNC QUEUE] RabbitMQ connection error:', err && err.message ? err.message : err);
      });
      this.connection.on('close', () => {
        console.warn('⚠️ [FLAG SYNC QUEUE] RabbitMQ connection closed');
        this.isInitialized = false;
      });

      this.channel = await this.connection.createChannel();
      // Attach channel-level handlers to avoid unhandled events that can crash the process
      this.channel.on('error', (err) => {
        console.error('❌ [FLAG SYNC QUEUE] RabbitMQ channel error:', err && err.message ? err.message : err);
      });
      this.channel.on('close', () => {
        console.warn('⚠️ [FLAG SYNC QUEUE] RabbitMQ channel closed');
        this.isInitialized = false;
      });

      // Assert the main flag sync queue (idempotent). Prefer assertQueue instead of checkQueue
      // to avoid race conditions and ensure the queue exists (if the RabbitMQ user has permission).
      try {
        await this.channel.assertQueue('SYNC_FLAGS_QUEUE', { durable: true });
        console.log('ℹ️ [FLAG SYNC QUEUE] SYNC_FLAGS_QUEUE is ready (asserted)');
      } catch (assertErr) {
        // If asserting fails (for example due to permissions or vhost misconfiguration),
        // log a clear error and rethrow so initialization caller can handle it.
        console.error('❌ [FLAG SYNC QUEUE] Failed to assert SYNC_FLAGS_QUEUE:', assertErr && assertErr.message ? assertErr.message : assertErr);
        throw assertErr;
      }
      
      this.isInitialized = true;
      console.log('✅ [FLAG SYNC QUEUE] Successfully initialized RabbitMQ connection');
      
    } catch (error) {
      console.error('❌ [FLAG SYNC QUEUE] Failed to initialize:', error.message);
      throw error;
    }
  }

  // Queue flag sync job for a specific user
  async queueFlagSync(userID, emailUIDs = [], priority = 5) {
    return this.publishLimit(async () => {
      try {
        if (!this.isInitialized) {
          await this.initialize();
        }

        const job = {
          userID,
          emailUIDs,
          timestamp: new Date().toISOString(),
          priority,
          jobId: `flag_sync_${userID}_${Date.now()}`,
          retryCount: 0,
          maxRetries: 3
        };

        // Send job to queue with priority
        await this.channel.sendToQueue(
          'SYNC_FLAGS_QUEUE',
          Buffer.from(JSON.stringify(job)),
          {
            persistent: true,
            priority: priority,
            messageId: job.jobId,
            timestamp: Date.now()
          }
        );

        console.log(`📤 [FLAG SYNC QUEUE] Queued flag sync for user ${userID} (${emailUIDs.length} emails, priority: ${priority})`);
        return job.jobId;

      } catch (error) {
        console.error(`❌ [FLAG SYNC QUEUE] Failed to queue flag sync for user ${userID}:`, error.message);
        throw error;
      }
    });
  }

  // Queue flag sync for multiple users (batch operation)
  async queueBatchFlagSync(userJobs) {
    const results = [];
    
    for (const userJob of userJobs) {
      try {
        const jobId = await this.queueFlagSync(
          userJob.userID,
          userJob.emailUIDs || [],
          userJob.priority || 5
        );
        results.push({ userID: userJob.userID, jobId, status: 'queued' });
      } catch (error) {
        results.push({ userID: userJob.userID, error: error.message, status: 'failed' });
      }
    }
    
    console.log(`📤 [FLAG SYNC QUEUE] Batch queued ${results.length} flag sync jobs`);
    return results;
  }

  // Get queue statistics
  async getQueueStats() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const queueInfo = await this.channel.checkQueue('SYNC_FLAGS_QUEUE');
      
      return {
        messageCount: queueInfo.messageCount,
        consumerCount: queueInfo.consumerCount,
        queueName: 'SYNC_FLAGS_QUEUE',
        status: 'healthy'
      };
      
    } catch (error) {
      console.error('❌ [FLAG SYNC QUEUE] Failed to get queue stats:', error.message);
      return {
        messageCount: 0,
        consumerCount: 0,
        queueName: 'SYNC_FLAGS_QUEUE',
        status: 'error',
        error: error.message
      };
    }
  }

  // Graceful shutdown
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.isInitialized = false;
      console.log('✅ [FLAG SYNC QUEUE] Connection closed gracefully');
    } catch (error) {
      console.error('❌ [FLAG SYNC QUEUE] Error during shutdown:', error.message);
    }
  }
}

// Export singleton instance
module.exports = new FlagSyncQueueService();