/**
 * 🔧 RabbitMQ Queue Management Utility
 * 
 * This utility helps clean up and recreate RabbitMQ queues when there are
 * parameter conflicts or other issues.
 */

const amqp = require('amqplib');

class QueueManager {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    try {
      this.connection = await amqp.connect('amqp://localhost');
      this.channel = await this.connection.createChannel();
      console.log('✅ Connected to RabbitMQ');
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error.message);
      throw error;
    }
  }

  async deleteQueue(queueName) {
    try {
      if (!this.channel) await this.connect();
      
      await this.channel.deleteQueue(queueName);
      console.log(`✅ Deleted queue: ${queueName}`);
      
    } catch (error) {
      console.error(`❌ Failed to delete queue ${queueName}:`, error.message);
      throw error;
    }
  }

  async recreateQueue(queueName, options = {}) {
    try {
      if (!this.channel) await this.connect();
      
      // Delete existing queue
      try {
        await this.channel.deleteQueue(queueName);
        console.log(`🗑️ Deleted existing queue: ${queueName}`);
      } catch (deleteError) {
        console.log(`ℹ️ Queue ${queueName} didn't exist or couldn't be deleted`);
      }
      
      // Create new queue with specified options
      await this.channel.assertQueue(queueName, options);
      console.log(`✅ Created queue: ${queueName} with options:`, options);
      
    } catch (error) {
      console.error(`❌ Failed to recreate queue ${queueName}:`, error.message);
      throw error;
    }
  }

  async listQueues() {
    try {
      if (!this.channel) await this.connect();
      
      // Note: This requires RabbitMQ management plugin
      console.log('ℹ️ To list queues, use: rabbitmqctl list_queues');
      
    } catch (error) {
      console.error('❌ Failed to list queues:', error.message);
      throw error;
    }
  }

  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      console.log('✅ Closed RabbitMQ connection');
    } catch (error) {
      console.error('❌ Error closing RabbitMQ connection:', error.message);
    }
  }
}

// CLI usage
async function main() {
  const queueManager = new QueueManager();
  
  try {
    const args = process.argv.slice(2);
    const command = args[0];
    const queueName = args[1];
    
    if (!command) {
      console.log(`
🔧 RabbitMQ Queue Manager

Usage:
  node queueManager.js delete <queue-name>     - Delete a queue
  node queueManager.js recreate <queue-name>   - Recreate SYNC_FLAGS_QUEUE
  node queueManager.js fix-flags               - Fix SYNC_FLAGS_QUEUE issues
  
Examples:
  node queueManager.js delete SYNC_FLAGS_QUEUE
  node queueManager.js fix-flags
      `);
      return;
    }
    
    await queueManager.connect();
    
    switch (command) {
      case 'delete':
        if (!queueName) {
          console.error('❌ Queue name is required for delete command');
          return;
        }
        await queueManager.deleteQueue(queueName);
        break;
        
      case 'recreate':
        if (!queueName) {
          console.error('❌ Queue name is required for recreate command');
          return;
        }
        await queueManager.recreateQueue(queueName, { durable: true });
        break;
        
      case 'fix-flags':
        console.log('🔧 Fixing SYNC_FLAGS_QUEUE...');
        await queueManager.recreateQueue('SYNC_FLAGS_QUEUE', {
          durable: true,
          arguments: {}  // No special arguments to avoid conflicts
        });
        console.log('✅ SYNC_FLAGS_QUEUE fixed!');
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
    }
    
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
  } finally {
    await queueManager.close();
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = QueueManager;