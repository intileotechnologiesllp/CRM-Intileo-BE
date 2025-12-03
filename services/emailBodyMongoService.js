const { EmailBody } = require('../models/mongodb');
const { cleanEmailBody, replaceCidReferences, processEmailBodyData } = require('../utils/emailProcessingUtils');

/**
 * EmailBody MongoDB Service
 * 
 * This service handles all email body operations with MongoDB,
 * replacing the MySQL body column storage approach
 */

class EmailBodyMongoService {
  
  /**
   * Save email body to MongoDB
   */
  static async saveEmailBody(emailID, masterUserID, bodyData, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`[EmailBodyMongoService] 💾 Saving email body for ${emailID} to MongoDB...`);
      
      // Convert IDs to strings to match MongoDB schema
      const emailIdString = String(emailID);
      const masterUserIdString = String(masterUserID);
      
      // Process body content using utility functions
      const processedData = processEmailBodyData(bodyData, options.attachments || [], {
        shouldClean: options.shouldClean !== false,
        preserveOriginal: options.preserveOriginal || false
      });
      
      // Prepare body data for MongoDB
      const mongoBodyData = {
        bodyHtml: bodyData.bodyHtml || null,
        bodyText: bodyData.bodyText || null,
        processedBody: processedData.processedBody,
        fetchStatus: 'completed',
        metadata: {
          originalSize: processedData.originalSize,
          processedSize: processedData.processedSize,
          contentType: processedData.contentType,
          hasImages: processedData.hasImages,
          hasAttachments: (options.attachments && options.attachments.length > 0) || false,
          hasCidReferences: processedData.hasCidReferences,
          encoding: bodyData.encoding || 'utf-8'
        },
        source: {
          provider: options.provider || 'unknown',
          imapFolder: options.imapFolder || 'unknown',
          messageId: options.messageId || null,
          uid: options.uid || null
        },
        performance: {
          fetchTime: options.fetchTime || 0,
          cleanTime: Date.now() - startTime,
          saveTime: 0 // Will be calculated in createOrUpdateBody
        },
        originalContent: {
          enabled: options.saveOriginal || false,
          bodyHtml: options.saveOriginal ? bodyData.bodyHtml : null,
          bodyText: options.saveOriginal ? bodyData.bodyText : null
        }
      };
      
      // Save to MongoDB
      const savedBody = await EmailBody.createOrUpdateBody(emailIdString, masterUserIdString, mongoBodyData);
      
      console.log(`[EmailBodyMongoService] ✅ Email body saved to MongoDB for ${emailID} - Size: ${processedData.processedSize} chars`);
      
      return {
        success: true,
        emailID,
        bodyLength: processedData.processedSize,
        mongoId: savedBody._id,
        version: savedBody.version
      };
      
    } catch (error) {
      console.error(`[EmailBodyMongoService] ❌ Error saving email body for ${emailID}:`, error);
      
      // Mark as failed in MongoDB
      await EmailBody.markAsFailed(String(emailID), String(masterUserID), error.message);
      
      return {
        success: false,
        emailID,
        error: error.message
      };
    }
  }
  
  /**
   * Get email body from MongoDB
   */
  static async getEmailBody(emailID, masterUserID, options = {}) {
    try {
      console.log(`[EmailBodyMongoService] 🔍 Fetching email body for ${emailID} from MongoDB...`);
      
      // Convert emailID to string to match MongoDB schema
      const emailIdString = String(emailID);
      const masterUserIdString = String(masterUserID);
      
      console.log(`[EmailBodyMongoService] 🔍 MongoDB Query: emailID="${emailIdString}", masterUserID="${masterUserIdString}"`);
      
      const result = await EmailBody.getBodyByEmailID(emailIdString, masterUserIdString);
      
      if (result.success) {
        console.log(`[EmailBodyMongoService] ✅ Email body retrieved from MongoDB for ${emailID} - Length: ${result.body.length}`);
        
        // Apply processing if requested
        if (options.cleanBody && result.bodyHtml) {
          const cleanedBody = options.preserveOriginal 
            ? replaceCidReferences(result.bodyHtml, options.attachments || [])
            : cleanEmailBody(result.bodyHtml, options.attachments || []);
          
          return {
            ...result,
            body: cleanedBody,
            processedBody: cleanedBody,
            wasProcessed: true
          };
        }
        
        return result;
      } else {
        console.log(`[EmailBodyMongoService] ⚠️ Email body not found in MongoDB for ${emailID}`);
        return result;
      }
      
    } catch (error) {
      console.error(`[EmailBodyMongoService] ❌ Error retrieving email body for ${emailID}:`, error);
      return {
        success: false,
        emailID,
        body: '',
        fetchStatus: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Check if email body exists in MongoDB
   */
  static async hasEmailBody(emailID, masterUserID) {
    try {
      const body = await EmailBody.findByEmailID(String(emailID), String(masterUserID));
      return {
        exists: !!body,
        status: body ? body.fetchStatus : 'not_found',
        hasContent: body && (body.bodyHtml || body.bodyText || body.processedBody),
        lastUpdated: body ? body.updatedAt : null
      };
    } catch (error) {
      console.error(`[EmailBodyMongoService] ❌ Error checking email body existence for ${emailID}:`, error);
      return {
        exists: false,
        status: 'error',
        hasContent: false,
        error: error.message
      };
    }
  }
  
  /**
   * Update email body processing status
   */
  static async updateBodyStatus(emailID, masterUserID, status, details = '') {
    try {
      const body = await EmailBody.findByEmailID(emailID, masterUserID);
      if (body) {
        await body.updateProcessingStatus(status, details);
        console.log(`[EmailBodyMongoService] 📝 Updated status for ${emailID} to ${status}`);
        return { success: true };
      } else {
        console.log(`[EmailBodyMongoService] ⚠️ Email body not found for status update: ${emailID}`);
        return { success: false, error: 'Email body not found' };
      }
    } catch (error) {
      console.error(`[EmailBodyMongoService] ❌ Error updating status for ${emailID}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Delete email body from MongoDB
   */
  static async deleteEmailBody(emailID, masterUserID) {
    try {
      const result = await EmailBody.deleteOne({ emailID, masterUserID });
      console.log(`[EmailBodyMongoService] 🗑️ Deleted email body for ${emailID} - Deleted: ${result.deletedCount}`);
      return {
        success: result.deletedCount > 0,
        deletedCount: result.deletedCount
      };
    } catch (error) {
      console.error(`[EmailBodyMongoService] ❌ Error deleting email body for ${emailID}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get email body statistics
   */
  static async getBodyStatistics(masterUserID) {
    try {
      const stats = await EmailBody.aggregate([
        { $match: { masterUserID } },
        {
          $group: {
            _id: '$fetchStatus',
            count: { $sum: 1 },
            totalSize: { $sum: '$metadata.processedSize' },
            avgSize: { $avg: '$metadata.processedSize' }
          }
        }
      ]);
      
      const totalBodies = await EmailBody.countDocuments({ masterUserID });
      
      return {
        success: true,
        totalBodies,
        statusBreakdown: stats,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error(`[EmailBodyMongoService] ❌ Error getting body statistics:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Migration helper: Move email body from MySQL to MongoDB
   */
  static async migrateEmailBodyFromMySQL(emailID, masterUserID, mysqlBody, attachments = []) {
    try {
      console.log(`[EmailBodyMongoService] 🔄 Migrating email body ${emailID} from MySQL to MongoDB...`);
      
      if (!mysqlBody || mysqlBody.trim() === '') {
        console.log(`[EmailBodyMongoService] ⚠️ Skipping migration for ${emailID} - Empty body`);
        return { success: false, reason: 'Empty body' };
      }
      
      // Determine if it's HTML or text
      const isHtml = mysqlBody.includes('<') && mysqlBody.includes('>');
      
      const bodyData = {
        bodyHtml: isHtml ? mysqlBody : null,
        bodyText: isHtml ? null : mysqlBody
      };
      
      const options = {
        shouldClean: true,
        preserveOriginal: false,
        attachments: attachments,
        provider: 'migration',
        saveOriginal: true // Keep original for migration verification
      };
      
      const result = await this.saveEmailBody(emailID, masterUserID, bodyData, options);
      
      if (result.success) {
        console.log(`[EmailBodyMongoService] ✅ Successfully migrated email body ${emailID} to MongoDB`);
      } else {
        console.log(`[EmailBodyMongoService] ❌ Failed to migrate email body ${emailID} to MongoDB:`, result.error);
      }
      
      return result;
      
    } catch (error) {
      console.error(`[EmailBodyMongoService] ❌ Error migrating email body ${emailID}:`, error);
      return {
        success: false,
        emailID,
        error: error.message
      };
    }
  }
  
  /**
   * Cleanup old email bodies (for maintenance)
   */
  static async cleanupOldBodies(daysOld = 365, dryRun = true) {
    try {
      const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
      
      const query = {
        createdAt: { $lt: cutoffDate },
        fetchStatus: { $in: ['completed', 'failed'] }
      };
      
      if (dryRun) {
        const count = await EmailBody.countDocuments(query);
        console.log(`[EmailBodyMongoService] 🧹 DRY RUN: Would delete ${count} email bodies older than ${daysOld} days`);
        return { success: true, wouldDelete: count, dryRun: true };
      } else {
        const result = await EmailBody.deleteMany(query);
        console.log(`[EmailBodyMongoService] 🧹 CLEANUP: Deleted ${result.deletedCount} email bodies older than ${daysOld} days`);
        return { success: true, deleted: result.deletedCount, dryRun: false };
      }
    } catch (error) {
      console.error(`[EmailBodyMongoService] ❌ Error during cleanup:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = EmailBodyMongoService;