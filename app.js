require("dotenv").config();
const express = require("express");
const path = require("path");
const sequelize = require("./config/db"); // Import Sequelize instance
const LoginHistory = require("./models/reports/loginHistoryModel"); // Import models
const Admin = require("./models/adminModel"); // Import models
const MasterUser = require("./models/master/masterUserModel"); // Import MasterUser model
const Designation = require("./models/admin/masters/designationModel"); // Import Designation model
const Department = require("./models/admin/masters/departmentModel"); // Import the Department model
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
const leadsRoutes = require("./routes/leads/leadRoutes"); // Import leads routes
const auditHistoryRoutes = require("./routes/reports/auditHistoryRoutes"); // Import audit history routes
const masterUserRoutes = require("./routes/auth/masterUserRoutes");
const historyRoutes=require("./routes/reports/historyRoutes"); // Import history routes
const privilegesRoutes = require("./routes/privileges/masterUserPrivilegesRoutes");
const leadColumnRoutes=require("./routes/admin/masters/leadColumn/leadColumn.js") // Import privileges routes
const emailRoutes = require("./routes/email/emailRoutes.js"); // Import email routes
const emailSettingController=require("./routes/email/emailSettingRoutes.js")
const Email = require("./models/email/emailModel"); // Import Email model
// const { initRabbitMQ } = require("./services/rabbitmqService");
const app = express();
require("./utils/cronJob.js")
app.use(express.static(path.join(__dirname, "public")));
// Serve static files from the "uploads" directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
console.log("Serving static files from:", path.join(__dirname, "public"),"........//.....//")
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
app.use("/api/leads", leadsRoutes);
app.use("/api/get-auditHistory", auditHistoryRoutes); // Register audit history routes
app.use("/api/master-user", masterUserRoutes); // Register master user routes
app.use("/api/get-history", historyRoutes); // Register history routes
app.use("/api/privileges", privilegesRoutes); // Register privileges routes
app.use("/api/lead-columns", leadColumnRoutes); // Register lead column routes
app.use("/api/email", emailRoutes); // Register email routes
app.use("/api/email-settings", emailSettingController); // Register email settings routes

app.get("/track/open/:tempMessageId", async (req, res) => {
  const { tempMessageId } = req.params;

  try {
    // Update the `isOpened` field for the email with the given `tempMessageId`
    await Email.update(
      { isOpened: true },
      { where: { tempMessageId } }
    );

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
    await Email.update(
      { isClicked: true },
      { where: { tempMessageId } }
    );

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
  .sync({ alter: false }) // Use `alter: true` to update the schema without dropping tables
  .then(() => console.log("Database synced successfully"))
  .catch((err) => console.error("Error syncing database:", err));

// Start server
const PORT = process.env.PORT || 3056;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
