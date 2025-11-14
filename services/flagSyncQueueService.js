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
      this.connection = await amqp.connect(process.env.RABBITMQ_URL ||'amqp://localhost');
      this.channel = await this.connection.createChannel();
      
      // Declare the main flag sync queue with durability
      // Create the queue directly without checking first
      console.log('🔧 [FLAG SYNC QUEUE] Ensuring SYNC_FLAGS_QUEUE exists...');
      
      // Assert queue with minimal settings to match existing queue
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

  // Queue flag sync job for a specific user with smart batching
  async queueFlagSync(userID, emailUIDs = [], priority = 5) {
    return this.publishLimit(async () => {
      try {
        if (!this.isInitialized) {
          await this.initialize();
        }

        // 🚀 FIX 1: Smart batching for large email sets
        const BATCH_SIZE = 200; // Process 200 emails per job
        
        if (emailUIDs.length === 0) {
          // Empty array means process all emails for user - but we'll batch them
          console.log(`📊 [FLAG SYNC BATCHING] Queuing flag sync for ALL emails of user ${userID}`);
          
          const job = {
            userID,
            emailUIDs: [],
            timestamp: new Date().toISOString(),
            priority,
            jobId: `flag_sync_${userID}_all_${Date.now()}`,
            retryCount: 0,
            maxRetries: 3,
            batchType: 'all_emails'
          };

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

          console.log(`📤 [FLAG SYNC QUEUE] Queued flag sync for ALL emails of user ${userID} (priority: ${priority})`);
          return job.jobId;
          
        } else if (emailUIDs.length <= BATCH_SIZE) {
          // Small batch, process as single job
          const job = {
            userID,
            emailUIDs,
            timestamp: new Date().toISOString(),
            priority,
            jobId: `flag_sync_${userID}_${Date.now()}`,
            retryCount: 0,
            maxRetries: 3,
            batchType: 'single_batch'
          };

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
          
        } else {
          // 🚀 Large email set - split into batches
          const totalBatches = Math.ceil(emailUIDs.length / BATCH_SIZE);
          console.log(`📊 [FLAG SYNC BATCHING] Splitting ${emailUIDs.length} emails into ${totalBatches} batches of ${BATCH_SIZE} for user ${userID}`);
          
          const batchJobIds = [];
          
          for (let i = 0; i < emailUIDs.length; i += BATCH_SIZE) {
            const batchUIDs = emailUIDs.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            
            const job = {
              userID,
              emailUIDs: batchUIDs,
              timestamp: new Date().toISOString(),
              priority: priority + (batchNumber === 1 ? 2 : 0), // Higher priority for first batch
              jobId: `flag_sync_${userID}_batch${batchNumber}_${Date.now()}`,
              retryCount: 0,
              maxRetries: 3,
              batchType: 'multi_batch',
              batchInfo: {
                batchNumber,
                totalBatches,
                isFirstBatch: batchNumber === 1,
                isLastBatch: batchNumber === totalBatches
              }
            };

            await this.channel.sendToQueue(
              'SYNC_FLAGS_QUEUE',
              Buffer.from(JSON.stringify(job)),
              {
                persistent: true,
                priority: job.priority,
                messageId: job.jobId,
                timestamp: Date.now()
              }
            );
            
            batchJobIds.push(job.jobId);
            
            // Small delay between batch submissions to spread load
            if (i + BATCH_SIZE < emailUIDs.length) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
          
          console.log(`📤 [FLAG SYNC BATCHING] Queued ${totalBatches} batches for user ${userID} (${emailUIDs.length} total emails)`);
          return batchJobIds; // Return array of job IDs for batched operation
        }

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