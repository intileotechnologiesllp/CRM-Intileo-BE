// CREATE GOAL API - Request Body Examples
// POST /api/goals

console.log("=== CREATE GOAL API - REQUEST BODY EXAMPLES ===\n");

// =============== EXAMPLE 1: MONTHLY DEAL GOAL (FIXED DURATION) ===============
const monthlyDealGoal = {
  // Optional - if you want to associate with a specific dashboard
  dashboardId: "dash_123",

  // Required fields
  entity: "Deal", // Required: "Deal", "Activity", "Lead"
  goalType: "Added", // Required: "Added", "Won", "Progressed" (for Deal), "Completed" (for Activity)
  startDate: "2025-07-01", // Required: ISO date string or YYYY-MM-DD

  // Target specification (one of these is required)
  targetValue: 15, // Total target for the goal period
  // OR use specific tracking fields:
  // "count": 15,                // If trackingMetric is "Count"
  // "value": 50000,             // If trackingMetric is "Value"

  // Duration settings
  endDate: "2025-09-30", // Optional: null/empty = indefinite goal
  period: "Monthly", // Optional: "daily", "weekly", "monthly", "quarterly", "yearly"

  // Tracking settings
  trackingMetric: "Count", // Optional: "Count" or "Value" (default: "Count")
  targetType: "number", // Optional: "number" or "currency" (auto-detected)

  // Assignment settings
  assignee: "John Doe", // Optional: legacy field for backward compatibility
  assignId: "user_456", // Optional: specific user ID, "everyone" for all users

  // Filtering settings
  pipeline: "Sales Pipeline", // Optional: specific pipeline for Deal goals

  // Description
  description: "Q3 Deal Addition Goal - Sales Team", // Optional: custom goal name
};

// =============== EXAMPLE 2: INDEFINITE ACTIVITY GOAL ===============
const indefiniteActivityGoal = {
  entity: "Activity",
  goalType: "Completed",
  startDate: "2025-07-01",
  endDate: null, // Indefinite goal - continues forever
  targetValue: 50,
  period: "monthly", // Using lowercase as per model default
  trackingMetric: "Count",
  assignId: "everyone", // Track for all users
  description: "Monthly Activity Completion - Ongoing",
};

// =============== EXAMPLE 3: QUARTERLY REVENUE GOAL ===============
const quarterlyRevenueGoal = {
  dashboardId: "sales_dashboard_789",
  entity: "Deal",
  goalType: "Won",
  startDate: "2025-07-01",
  endDate: "2025-09-30", // Q3 2025
  targetValue: 300000, // $300K for the quarter
  period: "quarterly",
  trackingMetric: "Value", // Track by monetary value
  targetType: "currency",
  assignId: "user_123", // Specific sales rep
  pipeline: "Enterprise Sales",
  description: "Q3 Enterprise Revenue Target",
};

// =============== EXAMPLE 4: YEARLY LEAD GOAL ===============
const yearlyLeadGoal = {
  entity: "Lead",
  goalType: "Added", // Note: Lead only supports "Added" type
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  targetValue: 1200, // 1200 leads for the year
  period: "yearly",
  trackingMetric: "Count",
  assignId: "everyone",
  description: "2025 Annual Lead Generation Goal",
};

// =============== EXAMPLE 5: MID-MONTH START GOAL ===============
const midMonthGoal = {
  entity: "Deal",
  goalType: "Progressed",
  startDate: "2025-07-15", // Starts mid-month
  endDate: "2025-08-31",
  targetValue: 20,
  period: "monthly",
  trackingMetric: "Count",
  assignId: "user_789",
  pipeline: "SMB Sales",
  description: "Deal Progression - Mid-July to August",
};

// =============== FIELD DESCRIPTIONS ===============
const fieldDescriptions = {
  // REQUIRED FIELDS
  entity: {
    required: true,
    type: "string",
    options: ["Deal", "Activity", "Lead"],
    description: "The type of entity to track",
  },
  goalType: {
    required: true,
    type: "string",
    options: {
      Deal: ["Added", "Won", "Progressed"],
      Activity: ["Completed"],
      Lead: ["Added"],
    },
    description: "The specific action to track for the entity",
  },
  startDate: {
    required: true,
    type: "string",
    format: "YYYY-MM-DD or ISO date string",
    description: "When the goal tracking begins",
  },

  // TARGET SPECIFICATION (at least one required)
  targetValue: {
    required: "if count/value not provided",
    type: "number",
    description: "The target number or value to achieve",
  },
  count: {
    required: "if targetValue not provided and trackingMetric is Count",
    type: "number",
    description: "Target count when using Count tracking metric",
  },
  value: {
    required: "if targetValue not provided and trackingMetric is Value",
    type: "number",
    description: "Target monetary value when using Value tracking metric",
  },

  // OPTIONAL FIELDS
  dashboardId: {
    required: false,
    type: "string",
    description: "Associate goal with specific dashboard",
  },
  endDate: {
    required: false,
    type: "string or null",
    format: "YYYY-MM-DD or ISO date string",
    description: "When goal tracking ends. null/empty = indefinite goal",
  },
  period: {
    required: false,
    type: "string",
    options: ["daily", "weekly", "monthly", "quarterly", "yearly"],
    default: "monthly",
    description: "How often the goal repeats/is evaluated",
  },
  trackingMetric: {
    required: false,
    type: "string",
    options: ["Count", "Value"],
    default: "Count",
    description: "Whether to track by quantity or monetary value",
  },
  assignId: {
    required: false,
    type: "string",
    options: ["user_id", "everyone"],
    description: "Which user(s) the goal applies to",
  },
  pipeline: {
    required: false,
    type: "string",
    description: "Specific pipeline to filter (Deal goals only)",
  },
  description: {
    required: false,
    type: "string",
    description: "Custom goal name/description",
  },
};

// =============== VALIDATION RULES ===============
const validationRules = {
  "Entity and Goal Type": "Both entity and goalType are required",
  "Start Date": "startDate is required and must be valid date format",
  "Target Value":
    "At least one of targetValue, count, or value must be provided",
  "End Date Logic": "If endDate provided, it must be after startDate",
  "Indefinite Goals": "Set endDate to null or empty string for ongoing goals",
  "Dashboard Association":
    "dashboardId is optional - goals can exist without dashboards",
  "Tracking Metric":
    "Value tracking only works with Deal goals that have monetary data",
  Assignment: "assignId can be specific user ID or 'everyone' for all users",
};

// =============== API RESPONSE EXAMPLES ===============
const successResponse = {
  success: true,
  message: "Goal created successfully",
  data: {
    goalId: "goal_abc123",
    entity: "Deal",
    goalType: "Added",
    targetValue: 15,
    startDate: "2025-07-01T00:00:00.000Z",
    endDate: "2025-09-30T23:59:59.999Z",
    frequency: "Monthly",
    trackingMetric: "Count",
    assignId: "user_456",
    isIndefinite: false,
    durationInfo: "Goal from 7/1/2025 to 9/30/2025",
    createdAt: "2025-07-31T12:00:00.000Z",
  },
};

const errorResponse = {
  success: false,
  message: "Start date is required",
  // or other validation error messages
};

// =============== OUTPUT ALL EXAMPLES ===============
console.log("1. Monthly Deal Goal (Fixed Duration):");
console.log(JSON.stringify(monthlyDealGoal, null, 2));
console.log("\n" + "=".repeat(60) + "\n");

console.log("2. Indefinite Activity Goal:");
console.log(JSON.stringify(indefiniteActivityGoal, null, 2));
console.log("\n" + "=".repeat(60) + "\n");

console.log("3. Quarterly Revenue Goal:");
console.log(JSON.stringify(quarterlyRevenueGoal, null, 2));
console.log("\n" + "=".repeat(60) + "\n");

console.log("4. Yearly Lead Goal:");
console.log(JSON.stringify(yearlyLeadGoal, null, 2));
console.log("\n" + "=".repeat(60) + "\n");

console.log("5. Mid-Month Start Goal:");
console.log(JSON.stringify(midMonthGoal, null, 2));
console.log("\n" + "=".repeat(60) + "\n");

console.log("Field Descriptions:");
console.log(JSON.stringify(fieldDescriptions, null, 2));
console.log("\n" + "=".repeat(60) + "\n");

console.log("Validation Rules:");
Object.entries(validationRules).forEach(([rule, description]) => {
  console.log(`${rule}: ${description}`);
});
console.log("\n" + "=".repeat(60) + "\n");

console.log("Success Response Example:");
console.log(JSON.stringify(successResponse, null, 2));
