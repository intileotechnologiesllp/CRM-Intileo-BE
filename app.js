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
const app = express();
app.use(express.static(path.join(__dirname, "public")));
const cors = require("cors");
app.use(cors());
// Middleware
app.use(express.json());

// Routes
app.use("/api/", adminRoutes);
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


// Sync database
sequelize
  .sync({ alter: true }) // Use `alter: true` to update the schema without dropping tables
  .then(() => console.log("Database synced successfully"))
  .catch((err) => console.error("Error syncing database:", err));

// Start server
const PORT = process.env.PORT || 3056;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
