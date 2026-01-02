const amqp = require('amqplib');
const pLimit = require('p-limit');
const Campaigns = require('../models/email/campaignsModel');
const EmailTemplate = require('../models/email/emailTemplateModel');
const Email = require('../models/email/emailModel');
const UserCredential = require('../models/email/userCredentialModel');
const nodemailer = require('nodemailer');

// 🚀 PRODUCTION ARCHITECTURE: Campaign Worker
// Dedicated worker process for processing campaign email jobs
// Each campaign has its own queue: CAMPAIGN_QUEUE_{campaignId}

class CampaignWorker {
  constructor(options = {}) {
    this.connection = null;
    this.channel = null;
    this.isRunning = false;
    this.processedJobs = 0;
    this.failedJobs = 0;
    this.activeCampaignQueues = new Map(); // Track active campaign queues
    
    // Worker configuration
    this.concurrency = options.concurrency || 3; // Max 3 concurrent email sends per worker
    this.prefetch = options.prefetch || 5; // Prefetch 5 messages at a time
    this.workerName = options.workerName || `campaign-worker-${process.pid}`;
    
    // Concurrency limiter for email sending
    this.sendLimit = pLimit(this.concurrency);
    
    console.log(`🏭 [${this.workerName}] Initialized with concurrency: ${this.concurrency}`);
  }

  // Start the worker
  async start() {
    try {
      console.log(`🚀 [${this.workerName}] Starting campaign worker...`);
      
      // Connect to RabbitMQ
      this.connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
      this.channel = await this.connection.createChannel();
      
      // Set prefetch count for this worker
      await this.channel.prefetch(this.prefetch);
      
      this.isRunning = true;
      
      // Start consuming messages from all campaign queues
      // We'll dynamically consume from queues as campaigns are queued
      this.setupDynamicQueueConsumption();
      
      console.log(`✅ [${this.workerName}] Worker started and ready for campaign jobs`);
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      console.error(`❌ [${this.workerName}] Failed to start worker:`, error.message);
      throw error;
    }
  }

  // Setup dynamic queue consumption - listens for new campaign queues
  async setupDynamicQueueConsumption() {
    // Consume from a pattern-based approach
    // We'll use a fanout exchange or consume from queues matching CAMPAIGN_QUEUE_*
    // For simplicity, we'll consume from queues as they're created by the cron job
    
    // Start consuming from existing campaign queues
    await this.consumeFromCampaignQueues();
    
    // Periodically check for new campaign queues (every 30 seconds)
    setInterval(async () => {
      await this.consumeFromCampaignQueues();
    }, 30000);
  }

  // Consume from all active campaign queues
  async consumeFromCampaignQueues() {
    try {
      // Get all campaigns that are active
      const activeCampaigns = await Campaigns.findAll({
        attributes: ['campaignId'],
        raw: true
      });

      for (const campaign of activeCampaigns) {
        const queueName = `CAMPAIGN_QUEUE_${campaign.campaignId}`;
        
        // Only consume if we haven't already set up consumption for this queue
        if (!this.activeCampaignQueues.has(queueName)) {
          try {
            // Assert queue exists
            await this.channel.assertQueue(queueName, { durable: true });
            
            // Start consuming from this queue
            await this.channel.consume(queueName, async (message) => {
              if (message) {
                await this.processCampaignJob(message, campaign.campaignId);
              }
            }, {
              noAck: false // Manual acknowledgment for reliability
            });
            
            this.activeCampaignQueues.set(queueName, true);
            console.log(`📬 [${this.workerName}] Now consuming from queue: ${queueName}`);
          } catch (error) {
            console.error(`❌ [${this.workerName}] Failed to consume from ${queueName}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error(`❌ [${this.workerName}] Error setting up campaign queues:`, error.message);
    }
  }

  // Process individual campaign job
  async processCampaignJob(message, campaignId) {
    let job;
    const jobStartTime = Date.now();
    
    try {
      job = JSON.parse(message.content.toString());
      console.log(`🔄 [${this.workerName}] Processing campaign job for campaign ${campaignId} (Job: ${job.jobId || 'N/A'})`);
      
      // 🛡️ JOB-LEVEL TIMEOUT PROTECTION: Prevent jobs from running indefinitely
      const JOB_TIMEOUT = 300000; // 5 minutes max per job
      
      const jobWithTimeout = async () => {
        return this.sendLimit(async () => {
          await this.processCampaignEmail(campaignId, job);
        });
      };
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Job timeout after ${JOB_TIMEOUT/1000}s`)), JOB_TIMEOUT)
      );
      
      // Race between job completion and timeout
      await Promise.race([jobWithTimeout(), timeoutPromise]);
      
      // Acknowledge successful processing
      this.channel.ack(message);
      this.processedJobs++;
      
      const jobDuration = ((Date.now() - jobStartTime) / 1000).toFixed(1);
      console.log(`✅ [${this.workerName}] Completed campaign job for campaign ${campaignId} in ${jobDuration}s (Total processed: ${this.processedJobs})`);
      
    } catch (error) {
      const jobDuration = ((Date.now() - jobStartTime) / 1000).toFixed(1);
      console.error(`❌ [${this.workerName}] Failed to process campaign job after ${jobDuration}s:`, error.message);
      
      // Check if it's a timeout error
      if (error.message.includes('timeout')) {
        console.log(`⏰ [${this.workerName}] JOB TIMEOUT DETECTED - job exceeded ${jobDuration}s limit`);
      }
      
      try {
        // Handle retry logic
        if (job && job.retryCount < (job.maxRetries || 3)) {
          await this.retryJob(job, message, campaignId);
        } else {
          // Max retries exceeded, reject message
          this.channel.nack(message, false, false);
          this.failedJobs++;
          console.error(`💀 [${this.workerName}] Campaign job failed permanently for campaign ${campaignId}`);
        }
      } catch (retryError) {
        console.error(`❌ [${this.workerName}] Retry handling failed:`, retryError.message);
        this.channel.nack(message, false, false);
        this.failedJobs++;
      }
    }
  }

  // Process campaign email sending
  async processCampaignEmail(campaignId, job) {
    try {
      console.log(`📧 [${this.workerName}] Processing campaign ${campaignId} email job`);
      
      // Fetch campaign details
      const campaign = await Campaigns.findByPk(campaignId);

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Validate sender email from campaign
      if (!campaign.sender) {
        throw new Error(`Campaign ${campaignId} has no sender email configured`);
      }

      // Get user credentials for the sender email
      const userCredential = await UserCredential.findOne({
        where: { email: campaign.sender },
        attributes: ['email', 'appPassword', 'provider', 'smtpHost', 'smtpPort', 'smtpSecure', 'masterUserID']
      });

      if (!userCredential) {
        throw new Error(`No email credentials found for sender ${campaign.sender}`);
      }

      // Get recipients from job
      const recipients = job.recipients || [];
      
      if (recipients.length === 0) {
        console.log(`⚠️ [${this.workerName}] No recipients in job for campaign ${campaignId}`);
        return;
      }

      // Get email template content
      let emailBody = '';
      if (campaign.emailContent) {
        const template = await EmailTemplate.findByPk(campaign.emailContent);
        if (template) {
          emailBody = template.body || '';
        }
      }

      // Create email transporter
      const transporter = this.createTransporter(userCredential);

      // Send emails to recipients
      let successCount = 0;
      let failCount = 0;

      for (const recipient of recipients) {
        try {
          const emailAddress = recipient.email || recipient;
          
          if (!emailAddress) {
            console.log(`⚠️ [${this.workerName}] Skipping recipient with no email:`, recipient);
            continue;
          }

          // Personalize email if recipient has name
          let personalizedBody = emailBody;
          if (recipient.name) {
            personalizedBody = personalizedBody.replace(/\{\{name\}\}/g, recipient.name);
            personalizedBody = personalizedBody.replace(/\{\{firstName\}\}/g, recipient.name.split(' ')[0]);
          }

          // Send email using campaign sender
          const mailOptions = {
            from: campaign.sender, // Use sender from campaign
            to: emailAddress,
            subject: campaign.subject,
            html: personalizedBody,
            text: personalizedBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
          };

          const info = await transporter.sendMail(mailOptions);
          
          // Save email record
          await Email.create({
            masterUserID: userCredential.masterUserID || campaign.createdBy,
            sender: campaign.sender, // Use sender from campaign
            recipient: emailAddress,
            subject: campaign.subject,
            body: personalizedBody,
            folder: 'sent',
            messageId: info.messageId
          });

          successCount++;
          console.log(`✅ [${this.workerName}] Sent email to ${emailAddress} for campaign ${campaignId}`);

          // Small delay between emails to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (emailError) {
          failCount++;
          console.error(`❌ [${this.workerName}] Failed to send email to ${recipient.email || recipient}:`, emailError.message);
        }
      }

      // Update campaign engagement metrics
      await this.updateCampaignEngagement(campaignId, successCount, failCount);

      console.log(`📊 [${this.workerName}] Campaign ${campaignId} processing complete: ${successCount} sent, ${failCount} failed`);

    } catch (error) {
      console.error(`❌ [${this.workerName}] Error processing campaign email:`, error.message);
      throw error;
    }
  }

  // Create email transporter based on user credentials
  createTransporter(userCredential) {
    const providerConfigs = {
      gmail: {
        service: 'gmail',
        auth: {
          user: userCredential.email,
          pass: userCredential.appPassword
        }
      },
      outlook: {
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: {
          user: userCredential.email,
          pass: userCredential.appPassword
        }
      },
      yahoo: {
        host: 'smtp.mail.yahoo.com',
        port: 587,
        secure: false,
        auth: {
          user: userCredential.email,
          pass: userCredential.appPassword
        }
      }
    };

    const provider = userCredential.provider || 'gmail';
    
    if (provider === 'custom' && userCredential.smtpHost) {
      return nodemailer.createTransport({
        host: userCredential.smtpHost,
        port: userCredential.smtpPort || 587,
        secure: userCredential.smtpSecure || false,
        auth: {
          user: userCredential.email,
          pass: userCredential.appPassword
        }
      });
    }

    const config = providerConfigs[provider] || providerConfigs.gmail;
    return nodemailer.createTransport(config);
  }

  // Update campaign engagement metrics
  async updateCampaignEngagement(campaignId, sentCount, failedCount) {
    try {
      const campaign = await Campaigns.findByPk(campaignId);
      if (!campaign) return;

      const engagement = campaign.Engagement || {};
      engagement.totalSent = (engagement.totalSent || 0) + sentCount;
      engagement.totalFailed = (engagement.totalFailed || 0) + failedCount;
      engagement.lastProcessedAt = new Date().toISOString();

      await campaign.update({ Engagement: engagement });
    } catch (error) {
      console.error(`❌ [${this.workerName}] Error updating campaign engagement:`, error.message);
    }
  }

  // Retry failed job
  async retryJob(job, originalMessage, campaignId) {
    try {
      job.retryCount = (job.retryCount || 0) + 1;
      job.retryTimestamp = new Date().toISOString();
      
      // Calculate delay based on retry count (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, job.retryCount), 60000); // Max 60 seconds
      
      console.log(`🔄 [${this.workerName}] Retrying campaign job for campaign ${campaignId} (attempt ${job.retryCount}/${job.maxRetries || 3}) in ${delay}ms`);
      
      const queueName = `CAMPAIGN_QUEUE_${campaignId}`;
      
      // Schedule retry
      setTimeout(async () => {
        try {
          await this.channel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(job)),
            {
              persistent: true,
              priority: Math.max(1, (job.priority || 5) - 1) // Lower priority for retries
            }
          );
        } catch (retryError) {
          console.error(`❌ [${this.workerName}] Failed to schedule retry:`, retryError.message);
        }
      }, delay);
      
      // Acknowledge original message
      this.channel.ack(originalMessage);
      
    } catch (error) {
      console.error(`❌ [${this.workerName}] Retry logic failed:`, error.message);
      throw error;
    }
  }

  // Setup graceful shutdown
  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      console.log(`🛑 [${this.workerName}] Received ${signal}, starting graceful shutdown...`);
      
      this.isRunning = false;
      
      // Close RabbitMQ connections
      try {
        if (this.channel) await this.channel.close();
        if (this.connection) await this.connection.close();
        console.log(`✅ [${this.workerName}] RabbitMQ connections closed`);
      } catch (error) {
        console.error(`❌ [${this.workerName}] Error closing RabbitMQ:`, error.message);
      }
      
      console.log(`✅ [${this.workerName}] Graceful shutdown completed. Processed: ${this.processedJobs}, Failed: ${this.failedJobs}`);
      process.exit(0);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  // Get worker statistics
  getStats() {
    return {
      workerName: this.workerName,
      isRunning: this.isRunning,
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs,
      activeQueues: this.activeCampaignQueues.size,
      concurrency: this.concurrency,
      uptime: process.uptime()
    };
  }
}

module.exports = CampaignWorker;

