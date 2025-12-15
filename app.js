require("dotenv").config();
const express = require("express");
const path = require("path");
const sequelize = require("./config/db"); // Import Sequelize instance
const { connectMongoDB } = require("./config/mongodb"); // Import MongoDB connection
const { connectRedis } = require("./config/redis"); // Import Redis connection
const LoginHistory = require("./models/reports/loginHistoryModel"); // Import models
const Admin = require("./models/adminModel"); // Import models
const MasterUser = require("./models/master/masterUserModel"); // Import MasterUser model
const Designation = require("./models/admin/masters/designationModel"); // Import Designation model
const Department = require("./models/admin/masters/departmentModel"); // Import the Department model
const Label = require("./models/admin/masters/labelModel"); // Import Label model
const adminRoutes = require("./routes/auth/adminRoutes"); // Import admin routes
const designationRoutes = require("./routes/admin/masters/designation/designationRoutes");
const departmentRoutes = require("./routes/admin/masters/department/departmentRoutes");
const organizationRoutes = require("./routes/admin/masters/organization/organizationRoutes"); // Import organization routes
const statusRoutes = require("./routes/admin/masters/status/statusRoutes"); // Import status routes
const scopeRoutes = require("./routes/admin/masters/scope/scopeRoutes"); // Import scope routes
const sectoralScopeRoutes = require("./routes/admin/masters/sectoralScope/sectoralScopeRoutes"); // Import sectoral scope routes
const programRoutes = require("./routes/admin/masters/program/programRoutes"); // Import program routes
const currencyRoutes = require("./routes/admin/masters/currency/currencyRoutes"); // Import currency routes
const countryRoutes = require("./routes/admin/masters/country/countryRoutes"); // Import country routes
const regionRoutes = require("./routes/admin/masters/region/regionRoutes"); // Import region routes
const labelRoutes = require("./routes/admin/masters/labels/labelRoutes"); // Import label routes
const leadsRoutes = require("./routes/leads/leadRoutes"); // Import leads routes
const auditHistoryRoutes = require("./routes/reports/auditHistoryRoutes"); // Import audit history routes
const masterUserRoutes = require("./routes/auth/masterUserRoutes");
const historyRoutes = require("./routes/reports/historyRoutes"); // Import history routes
const privilegesRoutes = require("./routes/privileges/masterUserPrivilegesRoutes");
const leadColumnRoutes = require("./routes/admin/masters/leadColumn/leadColumn.js"); // Import privileges routes
const emailRoutes = require("./routes/email/emailRoutes.js"); // Import email routes
const emailSettingController = require("./routes/email/emailSettingRoutes.js");
const Email = require("./models/email/emailModel"); // Import Email model
const leadFilterRoutes = require("./routes/leads/leadFilterRoutes"); // Import lead filter routes
const leadColumnController = require("./routes/leads/leadColumnRoutes.js"); // Import lead column controller
const leadContactsRoutes = require("./routes/leads/leadContactsRoutes.js"); // Import lead contacts routes
const dealRoutes = require("./routes/deals/dealsRoutes.js"); // Import deal routes
const activityRoutes = require("./routes/activity/activityRoutes.js"); // Import activity routes
const insightRoutes = require("./routes/insight/insightRoutes.js"); // Import insight routes
const activityReportRoutes = require("./routes/insight/report/activityReportRoutes.js"); // Import insight routes
const leadReportRoutes = require("./routes/insight/report/leadReportRoutes.js"); // Import insight routes
const dealReportRoutes = require("./routes/insight/report/dealReportRouter.js"); // Import deal report routes
const contactReportRoutes = require("./routes/insight/report/contactReportRoutes.js")
const organizationReportRoutes = require("./routes/insight/report/organizationReportRoutes.js")
const customFieldRoutes = require("./routes/customFieldRoutes.js"); // Import custom field routes
const pipelineRoutes = require("./routes/pipelineRoutes.js"); // Import pipeline routes
const globalSearchRoutes = require("./routes/globalSearchRoutes.js"); // Import global search routes
const reportFolderRoutes = require("./routes/insight/reportFolderRoutes.js")
const dashboardCardRoutes = require("./routes/insight/cardRoutes.js")
const personRoutes = require("./routes/personRoutes.js"); // Import person routes
const organizationRoutesNew = require("./routes/organizationRoutes.js"); // Import organization routes
const visibilityGroupRoutes = require("./routes/admin/visibilityGroupRoutes.js"); // Import visibility group routes
const companySettingsRoutes = require("./routes/companySettingsRoutes.js"); // Import company settings routes
const groupVisibilityRoutes = require("./routes/admin/groupVisibilityRoutes.js")
const activitySettingRoutes = require("./routes/activity/activitySettingRoutes.js"); // Import activity setting routes
const importRoutes = require("./routes/import/importRoutes.js"); // Import data import routes
const activityTypeRoutes = require('./routes/activity/activityTypeRoutes.js'); // Import activity type routes
const userSessionRoutes = require("./routes/userSessionRoutes.js"); // Import user session/device management routes
const userFavoritesRoutes = require("./routes/favorites/userFavoritesRoutes.js"); // Import user favorites routes
const lostReasonRoutes = require('./routes/lostReason/lostReasonRoutes'); // Import lost reason routes
const permissionRoutes = require('./routes/permissionSetRoutes.js'); // Import lost reason routes
const contactSyncRoutes = require('./routes/contact/contactSyncRoutes.js'); // Import contact sync routes
const productRoutes = require('./routes/product/productRoutes.js'); // Import product routes
const mongodbRoutes = require('./routes/mongodb/mongodbRoutes.js'); // Import MongoDB routes
//const contactSyncRoutes = require('./routes/contact/contactSyncRoutes.js'); // Import contact sync routes
const userInterfacePreferencesRoutes = require('./routes/userInterfacePreferencesRoutes.js'); // Import user interface preferences routes
const googleDriveRoutes  = require('./routes/google-drive/googledrive.js'); // Import Google Drive routes

const { loadPrograms } = require("./utils/programCache");
const imapIdleManager = require('./services/imapIdleManager'); // IMAP IDLE for real-time sync
const { initializeSocket } = require('./config/socket'); // Socket.IO for real-time notifications
const http = require('http');
// const { initRabbitMQ } = require("./services/rabbitmqService");
const app = express();
const server = http.createServer(app); // Create HTTP server for Socket.IO
require("./utils/cronJob.js");
// REMOVED: Email queue workers are now handled by dedicated PM2 processes
// require("./utils/emailQueueWorker");
app.use(express.static(path.join(__dirname, "public")));
// Serve static files from the "uploads" directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
console.log(
  "Serving static files from:",
  path.join(__dirname, "public"),
  "........//.....//"
);
const cors = require("cors");
app.use(cors());
// Middleware
app.use(express.json());
// Expose environment variables to the frontend
app.get("/api/env", (req, res) => {
  res.json({
    FRONTEND_URL: process.env.FRONTEND_URL,
  });
});

// await loadPrograms(); // Call this once at startup
// Routes
app.use("/api", adminRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/organizations", organizationRoutes); // Register organization routes
app.use("/api/status", statusRoutes); // Register status routes
app.use("/api/scopes", scopeRoutes); // Register scope routes
app.use("/api/sectoral-scopes", sectoralScopeRoutes); // Register sectoral scope routes
app.use("/api/programs", programRoutes); // Register program routes
app.use("/api/currencies", currencyRoutes); // Register currency routes
app.use("/api/countries", countryRoutes); // Register country routes
app.use("/api/regions", regionRoutes); // Register region routes
app.use("/api/labels", labelRoutes); // Register label routes
app.use("/api/company-settings", companySettingsRoutes); // Register company settings routes
app.use("/api/leads", leadsRoutes);
app.use("/api/get-auditHistory", auditHistoryRoutes); // Register audit history routes
app.use("/api/master-user", masterUserRoutes); // Register master user routes
 //app.use("/api", masterUserRoutes); // Register master user routes
app.use("/api/get-history", historyRoutes); // Register history routes
app.use("/api/privileges", privilegesRoutes); // Register privileges routes
app.use("/api/lead-columns", leadColumnRoutes); // Register lead column routes
app.use("/api/email", emailRoutes); // Register email routes
app.use("/api/email-settings", emailSettingController); // Register email settings routes
app.use("/api/lead-filters", leadFilterRoutes); // Register lead filter routes
app.use("/api/lead-column", leadColumnController); // Register lead column controller routes
app.use("/api/lead-contacts", leadContactsRoutes); // Register lead contacts routes
app.use("/api/deals", dealRoutes); // Register deal routes
app.use("/api/activities", activityRoutes); // Register activity routes
app.use("/api/insights", insightRoutes); // Register insight routes
app.use("/api/activityreport", activityReportRoutes); // Register activity report routes
app.use("/api/leadreport", leadReportRoutes); // Register Lead report routes
app.use("/api/dealreport", dealReportRoutes);
app.use("/api/contactreport", contactReportRoutes);
app.use("/api/organizationreport", organizationReportRoutes);
app.use("/api/reportFolder", reportFolderRoutes); // Register report folder routes
app.use("/api/dashboardcards", dashboardCardRoutes); // Register dashboardCard Routes
app.use("/api/search", globalSearchRoutes); // Register global search routes
app.use("/api/custom-fields", customFieldRoutes); // Register custom field routes
app.use("/api/pipelines", pipelineRoutes); // Register pipeline routes
app.use("/api/persons", personRoutes); // Register person routes
app.use("/api/organizations-new", organizationRoutesNew); // Register organization routes (new)
app.use("/api/visibility-groups", visibilityGroupRoutes); // Register visibility group routes
app.use("/api/persons", personRoutes); // Register person routes
app.use("/api/organizations-new", organizationRoutesNew); // Register new organization routes
app.use("/api/global-search", globalSearchRoutes); // Register global search routes
app.use("/api/groupvisibility", groupVisibilityRoutes);
app.use("/api/activity-settings", activitySettingRoutes); // Register activity setting routes
app.use("/api/activity-types", activityTypeRoutes); // Register activity type routes
app.use("/api/favorites", userFavoritesRoutes); // Register user favorites routes
app.use('/api/lost-reasons', lostReasonRoutes); // Register lost reason routescl
app.use('/api/permissions', permissionRoutes); // Register lost reason routescl
app.use('/api/import', importRoutes); // Register data import routes
app.use('/api/contact-sync', contactSyncRoutes); // Register contact sync routes
app.use('/api/user-sessions', userSessionRoutes); // Register user session/device management routes
app.use('/api/products', productRoutes); // Register product routes
app.use('/api/mongodb', mongodbRoutes); // Register MongoDB analytics routes
app.use('/api/interface-preferences', userInterfacePreferencesRoutes); // Register user interface preferences routes
app.use('/api/contact-sync', contactSyncRoutes); // Register contact sync routes
app.use('/api/user-sessions', userSessionRoutes); // Register user session/device management routes
app.use('/api/drive', googleDriveRoutes); // Register user session/device management routes

// Notification routes (will be added next)
const notificationRoutes = require('./routes/notification/notificationRoutes.js'); // Import notification routes
app.use('/api/notifications', notificationRoutes); // Register notification routes

app.get("/track/open/:tempMessageId", async (req, res) => {
  const { tempMessageId } = req.params;

  try {
    // Update the `isOpened` field for the email with the given `tempMessageId`
    await Email.update({ isOpened: true }, { where: { tempMessageId } });

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
    // Update the `isClicked` field for the email with the given `tempMessageId`
    await Email.update({ isClicked: true }, { where: { tempMessageId } });

    // Redirect to the original URL
    res.redirect(url);
  } catch (error) {
    console.error("Error tracking link click:", error);
    res.status(500).send("Internal Server Error");
  }
});

// (async () => {
//   try {
//     await initRabbitMQ(); // Initialize RabbitMQ
//     console.log("RabbitMQ initialized successfully.");
//   } catch (error) {
//     console.error("Failed to initialize RabbitMQ:", error);
//     process.exit(1); // Exit the application if RabbitMQ fails to initialize
//   }
// })();

// Sync database
sequelize
  .sync({ alter: false, force: false }) // Don't alter existing tables for deployment safety
  .then(() => console.log("Database synced successfully"))
  .catch((err) => console.error("Error syncing database:", err));

// Start server
(async () => {
  try {
    // Initialize MongoDB connection
    console.log("🔄 Initializing MongoDB connection...");
    const mongoConnected = await connectMongoDB();
    
    // Initialize Redis connection
    console.log("🔄 Initializing Redis connection...");
    const redisConnected = await connectRedis();
    
    await loadPrograms();
    console.log("Program cache loaded.");
    
    // � Initialize Socket.IO for real-time notifications
    console.log("🔄 Initializing Socket.IO...");
    initializeSocket(server);
    console.log("✅ Socket.IO initialized for real-time notifications");
    
    // �🚀 Initialize IMAP IDLE Manager for real-time email sync (only if MongoDB is available)
    try {
      if (mongoConnected) {
        await imapIdleManager.initialize();
        console.log('✅ IMAP IDLE Manager initialized for real-time email sync');
        
        // Set up event handlers for real-time updates
        imapIdleManager.on('newMail', (data) => {
          console.log(`📬 [IMAP-IDLE] New mail for user ${data.userID}: ${data.messageCount} messages`);
          // You can emit WebSocket events here for real-time UI updates
        });
        
        imapIdleManager.on('flagChange', (data) => {
          console.log(`🔄 [IMAP-IDLE] Flag change for user ${data.userID}: UID ${data.uid} isRead=${data.isRead}`);
          // You can emit WebSocket events here for real-time UI updates
        });
      } else {
        console.log('⚠️ Skipping IMAP IDLE Manager - MongoDB not available');
      }
      
    } catch (idleError) {
      console.warn('⚠️ IMAP IDLE Manager failed to initialize:', idleError.message);
      console.log('📧 Email functionality will work without real-time sync');
    }
    
    // Start server after loading programs and initializing IMAP IDLE
    const PORT = process.env.PORT || 3056;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 MySQL Database: Connected via Sequelize`);
      console.log(`🍃 MongoDB: ${mongoConnected ? 'Connected' : 'Unavailable'}`);
      console.log(`🔴 Redis: ${redisConnected ? 'Connected' : 'Unavailable'}`);
      console.log(`🔔 Socket.IO: ACTIVE (Real-time notifications)`);
      console.log(`🌐 Application URL: ${process.env.LOCALHOST_URL || `http://localhost:${PORT}`}`);
      console.log(`📧 Real-time email sync: ${imapIdleManager.isInitialized ? 'ACTIVE' : 'DISABLED'}`);
    });
  } catch (err) {
    console.error("Failed to initialize application:", err);
    process.exit(1);
  }
})();