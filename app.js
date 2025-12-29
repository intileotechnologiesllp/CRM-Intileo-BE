require("dotenv").config();
const express = require("express");
const path = require("path");
const { centralSequelize } = require("./config/db"); // Import central Sequelize instance
const { connectMongoDB } = require("./config/mongodb"); // Import MongoDB connection
const { connectRedis } = require("./config/redis"); // Import Redis connection
const { loadPrograms } = require("./utils/programCache");
const imapIdleManager = require('./services/imapIdleManager'); // IMAP IDLE for real-time sync
const { initializeSocket, getIO } = require('./config/socket'); // Socket.IO for real-time notifications
const http = require('http');

// Clear all model caches on startup to ensure fresh connections
console.log('🧹 Clearing all module caches on startup...');
Object.keys(require.cache).forEach(key => {
  delete require.cache[key];
});

// Import routes
const adminRoutes = require("./routes/auth/adminRoutes");
const twoFactorRoutes = require("./routes/auth/twoFactorRoutes");
const designationRoutes = require("./routes/admin/masters/designation/designationRoutes");
const departmentRoutes = require("./routes/admin/masters/department/departmentRoutes");
const organizationRoutes = require("./routes/admin/masters/organization/organizationRoutes");
const statusRoutes = require("./routes/admin/masters/status/statusRoutes");
const scopeRoutes = require("./routes/admin/masters/scope/scopeRoutes");
const sectoralScopeRoutes = require("./routes/admin/masters/sectoralScope/sectoralScopeRoutes");
const programRoutes = require("./routes/admin/masters/program/programRoutes");
const currencyRoutes = require("./routes/admin/masters/currency/currencyRoutes");
const countryRoutes = require("./routes/admin/masters/country/countryRoutes");
const regionRoutes = require("./routes/admin/masters/region/regionRoutes");
const labelRoutes = require("./routes/admin/masters/labels/labelRoutes");
const companySettingsRoutes = require("./routes/companySettingsRoutes");
const leadsRoutes = require("./routes/leads/leadRoutes");
const auditHistoryRoutes = require("./routes/reports/auditHistoryRoutes");
const masterUserRoutes = require("./routes/auth/masterUserRoutes");
const historyRoutes = require("./routes/reports/historyRoutes");
const privilegesRoutes = require("./routes/privileges/masterUserPrivilegesRoutes");
const leadColumnRoutes = require("./routes/admin/masters/leadColumn/leadColumn");
const emailRoutes = require("./routes/email/emailRoutes");
const emailSettingController = require("./routes/email/emailSettingRoutes");
const leadFilterRoutes = require("./routes/leads/leadFilterRoutes");
const leadColumnController = require("./routes/leads/leadColumnRoutes");
const leadContactsRoutes = require("./routes/leads/leadContactsRoutes");
const dealRoutes = require("./routes/deals/dealsRoutes");
const activityRoutes = require("./routes/activity/activityRoutes");
const insightRoutes = require("./routes/insight/insightRoutes");
const activityReportRoutes = require("./routes/insight/report/activityReportRoutes");
const leadReportRoutes = require("./routes/insight/report/leadReportRoutes");
const dealReportRoutes = require("./routes/insight/report/dealReportRouter");
const contactReportRoutes = require("./routes/insight/report/contactReportRoutes");
const organizationReportRoutes = require("./routes/insight/report/organizationReportRoutes");
const customFieldRoutes = require("./routes/customFieldRoutes");
const pipelineRoutes = require("./routes/pipelineRoutes");
const globalSearchRoutes = require("./routes/globalSearchRoutes");
const reportFolderRoutes = require("./routes/insight/reportFolderRoutes");
const dashboardCardRoutes = require("./routes/insight/cardRoutes");
const personRoutes = require("./routes/personRoutes");
const organizationRoutesNew = require("./routes/organizationRoutes");
const visibilityGroupRoutes = require("./routes/admin/visibilityGroupRoutes");
const groupVisibilityRoutes = require("./routes/admin/groupVisibilityRoutes");
const activitySettingRoutes = require("./routes/activity/activitySettingRoutes");
const importRoutes = require("./routes/import/importRoutes");
const activityTypeRoutes = require('./routes/activity/activityTypeRoutes');
const userSessionRoutes = require("./routes/userSessionRoutes");
const userFavoritesRoutes = require("./routes/favorites/userFavoritesRoutes");
const lostReasonRoutes = require('./routes/lostReason/lostReasonRoutes');
const permissionRoutes = require('./routes/permissionSetRoutes');
const contactSyncRoutes = require('./routes/contact/contactSyncRoutes');
const productRoutes = require('./routes/product/productRoutes');
const mongodbRoutes = require('./routes/mongodb/mongodbRoutes');
const userInterfacePreferencesRoutes = require('./routes/userInterfacePreferencesRoutes');
const googleDriveRoutes = require('./routes/google-drive/googledrive');
const meetingRoutes = require('./routes/meeting/meetingRoutes');
const schedulingLinkRoutes = require('./routes/meeting/schedulingLinkRoutes');
const mergeRoutes = require('./routes/merge/mergeRoute');
const notificationRoutes = require('./routes/notification/notificationRoutes');

const app = express();
const server = http.createServer(app);

// Start cron jobs
require("./utils/cronJob.js");

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
console.log("Serving static files from:", path.join(__dirname, "public"));

// CORS
const cors = require("cors");
app.use(cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Environment variables endpoint
app.get("/api/env", (req, res) => {
  res.json({
    FRONTEND_URL: process.env.FRONTEND_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
});

// Debug middleware for 2FA routes
app.use("/api/auth/2fa", (req, res, next) => {
  console.log('🔍 [MIDDLEWARE] 2FA Route intercepted!');
  console.log('📍 Method:', req.method);
  console.log('📍 URL:', req.url);
  next();
});

// Register routes
app.use("/api/auth/2fa", twoFactorRoutes);
app.use("/api", adminRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/scopes", scopeRoutes);
app.use("/api/sectoral-scopes", sectoralScopeRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/currencies", currencyRoutes);
app.use("/api/countries", countryRoutes);
app.use("/api/regions", regionRoutes);
app.use("/api/labels", labelRoutes);
app.use("/api/company-settings", companySettingsRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/get-auditHistory", auditHistoryRoutes);
app.use("/api/master-user", masterUserRoutes);
app.use("/api/get-history", historyRoutes);
app.use("/api/privileges", privilegesRoutes);
app.use("/api/lead-columns", leadColumnRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/email-settings", emailSettingController);
app.use("/api/lead-filters", leadFilterRoutes);
app.use("/api/lead-column", leadColumnController);
app.use("/api/lead-contacts", leadContactsRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/insights", insightRoutes);
app.use("/api/activityreport", activityReportRoutes);
app.use("/api/leadreport", leadReportRoutes);
app.use("/api/dealreport", dealReportRoutes);
app.use("/api/contactreport", contactReportRoutes);
app.use("/api/organizationreport", organizationReportRoutes);
app.use("/api/reportFolder", reportFolderRoutes);
app.use("/api/dashboardcards", dashboardCardRoutes);
app.use("/api/search", globalSearchRoutes);
app.use("/api/custom-fields", customFieldRoutes);
app.use("/api/pipelines", pipelineRoutes);
app.use("/api/persons", personRoutes);
app.use("/api/organizations-new", organizationRoutesNew);
app.use("/api/visibility-groups", visibilityGroupRoutes);
app.use("/api/groupvisibility", groupVisibilityRoutes);
app.use("/api/activity-settings", activitySettingRoutes);
app.use("/api/activity-types", activityTypeRoutes);
app.use("/api/favorites", userFavoritesRoutes);
app.use('/api/lost-reasons', lostReasonRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/import', importRoutes);
app.use('/api/contact-sync', contactSyncRoutes);
app.use('/api/user-sessions', userSessionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/mongodb', mongodbRoutes);
app.use('/api/interface-preferences', userInterfacePreferencesRoutes);
app.use('/api/drive', googleDriveRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/meetings/scheduling-links', schedulingLinkRoutes);
app.use('/api/merge', mergeRoutes);
app.use('/api/notifications', notificationRoutes);

// Public scheduling link routes
const schedulingLinkController = require('./controllers/meeting/schedulingLinkController');
app.get('/api/meetings/scheduling/:token', schedulingLinkController.getLinkDetailsPublic);
app.get('/api/meetings/scheduling/:token/available-slots', schedulingLinkController.getAvailableSlotsPublic);
app.post('/api/meetings/scheduling/:token/book', schedulingLinkController.bookMeeting);

// Email tracking routes
app.get("/track/open/:tempMessageId", async (req, res) => {
  const { tempMessageId } = req.params;

  try {
    // Note: Email model needs to be loaded dynamically per client
    // This is a simplified version - in production, you'd need to identify which client's database to use
    console.log(`Email open tracking called for tempMessageId: ${tempMessageId}`);
    
    // Return a 1x1 transparent pixel
    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAgMBAp6KfAAAAABJRU5ErkJggg==",
      "base64"
    );
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": pixel.length,
    });
    res.end(pixel);
  } catch (error) {
    console.error("Error tracking email open:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/track/click", async (req, res) => {
  const { tempMessageId, url } = req.query;

  try {
    console.log(`Email click tracking called for tempMessageId: ${tempMessageId}, URL: ${url}`);
    
    // Redirect to the original URL
    res.redirect(url || '/');
  } catch (error) {
    console.error("Error tracking link click:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Debug route for Socket.IO testing
app.post('/debug/emit-all', (req, res) => {
  try {
    const payload = req.body && Object.keys(req.body).length
      ? req.body
      : { notification: { title: 'debug', message: 'hi' }, unreadCount: 1 };

    const io = getIO();
    io.emit('new_notification', payload);
    console.log("📤 [Debug] Emitted 'new_notification' to all connected clients", payload);
    res.json({ ok: true });
  } catch (error) {
    console.error('[Debug] Failed to emit new_notification to all:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'CRM Multi-tenant API',
    version: '1.0.0'
  });
});

// Database connection test
app.get('/test-db', async (req, res) => {
  try {
    await centralSequelize.authenticate();
    res.json({
      success: true,
      message: 'Central database connection successful',
      database: process.env.CENTRAL_DB_NAME || 'crm_central'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Central database connection failed',
      error: error.message
    });
  }
});

// Client connection test
app.get('/test-client-db/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Get client info from central database
    const [client] = await centralSequelize.query(
      `SELECT * FROM client WHERE id = ? LIMIT 1`,
      {
        replacements: [clientId],
        type: centralSequelize.QueryTypes.SELECT
      }
    );
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found in central database'
      });
    }
    
    // Try to connect to client's database
    const { getClientDbConnection } = require('./config/db');
    const clientSequelize = await getClientDbConnection(client);
    
    res.json({
      success: true,
      message: `Connected to client database: ${client.db_name}`,
      client: {
        id: client.id,
        name: client.name,
        organizationName: client.organizationName,
        dbName: client.db_name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Client database connection failed',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Ensure require patches are cleaned up
  if (req._restoreRequire) {
    req._restoreRequire();
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start server
(async () => {
  try {
    console.log("🚀 Starting CRM Multi-tenant Application...");
    
    // Sync central database
    console.log("🔄 Syncing central database...");
    await centralSequelize.sync({ alter: false, force: false });
    console.log("✅ Central database synced successfully");
    
    // Initialize MongoDB connection
    console.log("🔄 Initializing MongoDB connection...");
    const mongoConnected = await connectMongoDB();
    
    // Initialize Redis connection
    console.log("🔄 Initializing Redis connection...");
    const redisConnected = await connectRedis();
    
    // Load programs
    console.log("🔄 Loading program cache...");
    await loadPrograms();
    console.log("✅ Program cache loaded");
    
    // Initialize Socket.IO
    console.log("🔄 Initializing Socket.IO...");
    initializeSocket(server);
    console.log("✅ Socket.IO initialized for real-time notifications");
    
    // Initialize IMAP IDLE Manager
    try {
      if (mongoConnected) {
        await imapIdleManager.initialize();
        console.log('✅ IMAP IDLE Manager initialized for real-time email sync');
        
        imapIdleManager.on('newMail', (data) => {
          console.log(`📬 [IMAP-IDLE] New mail for user ${data.userID}: ${data.messageCount} messages`);
        });
        
        imapIdleManager.on('flagChange', (data) => {
          console.log(`🔄 [IMAP-IDLE] Flag change for user ${data.userID}: UID ${data.uid} isRead=${data.isRead}`);
        });
      } else {
        console.log('⚠️ Skipping IMAP IDLE Manager - MongoDB not available');
      }
    } catch (idleError) {
      console.warn('⚠️ IMAP IDLE Manager failed to initialize:', idleError.message);
      console.log('📧 Email functionality will work without real-time sync');
    }
    
    // Start server
    const PORT = process.env.PORT || 3056;
    server.listen(PORT, () => {
      console.log(`\n🎉 CRM Multi-tenant Application Started Successfully!`);
      console.log(`====================================================`);
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🌐 Application URL: ${process.env.LOCALHOST_URL || `http://localhost:${PORT}`}`);
      console.log(`\n🔧 Database Connections:`);
      console.log(`   📊 MySQL Central DB: ${process.env.CENTRAL_DB_NAME || 'crm_central'} ✅`);
      console.log(`   📊 MySQL Client DBs: Dynamic connections ✅`);
      console.log(`   🍃 MongoDB: ${mongoConnected ? 'Connected ✅' : 'Unavailable ⚠️'}`);
      console.log(`   🔴 Redis: ${redisConnected ? 'Connected ✅' : 'Unavailable ⚠️'}`);
      console.log(`\n🔔 Real-time Features:`);
      console.log(`   📡 Socket.IO: ACTIVE ✅`);
      console.log(`   📧 Real-time email: ${imapIdleManager.isInitialized ? 'ACTIVE ✅' : 'DISABLED ⚠️'}`);
      console.log(`\n📋 Available Endpoints:`);
      console.log(`   POST /api/auth/connect-db    - Connect to client database`);
      console.log(`   POST /api/auth/signin        - User signin`);
      console.log(`   GET  /health                 - Health check`);
      console.log(`   GET  /test-db                - Test central DB connection`);
      console.log(`   GET  /test-client-db/:id     - Test client DB connection`);
      console.log(`\n====================================================`);
    });
    
  } catch (err) {
    console.error("❌ Failed to initialize application:", err);
    process.exit(1);
  }
})();