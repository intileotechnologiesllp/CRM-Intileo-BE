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
      this.connection = await amqp.connect('amqp://localhost');
      this.channel = await this.connection.createChannel();
      
      // Declare the main flag sync queue with durability
      // First, try to check if queue exists with different settings
      try {
        await this.channel.checkQueue('SYNC_FLAGS_QUEUE');
        console.log('ℹ️ [FLAG SYNC QUEUE] Using existing SYNC_FLAGS_QUEUE');
      } catch (checkError) {
        // Queue doesn't exist, create it
        console.log('🔧 [FLAG SYNC QUEUE] Creating new SYNC_FLAGS_QUEUE');
      }
      
      // Assert queue with minimal settings to avoid conflicts
      await this.channel.assertQueue('SYNC_FLAGS_QUEUE', {
        durable: true
      });
      
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