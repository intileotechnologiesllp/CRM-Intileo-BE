// CREATE PROGRESSED GOAL - DETAILED REQUEST BODY SPECIFICATION

console.log("=== CREATE PROGRESSED GOALS - REQUEST BODY SPECIFICATION ===\n");

// =============== BASIC PROGRESSED GOAL ===============
console.log("1. BASIC PROGRESSED GOAL REQUEST:");
console.log("POST /api/insight/create-goals");
console.log("Content-Type: application/json");
console.log("Authorization: Bearer <your-token>");
console.log("\nRequest Body:");

const basicProgressedGoal = {
  // === REQUIRED FIELDS ===
  entity: "Deal", // MUST be "Deal" for progressed goals
  goalType: "Progressed", // MUST be "Progressed"
  startDate: "2025-08-01", // Goal start date (YYYY-MM-DD format)
  targetValue: 50, // Target number/value to achieve

  // === REQUIRED FOR PROGRESSED GOALS ===
  pipeline: "Climate Change", // Pipeline name (REQUIRED for Progressed)
  pipelineStage: "Qualified", // Target stage (REQUIRED for Progressed)

  // === OPTIONAL FIELDS ===
  endDate: "2025-08-31", // Goal end date (null for indefinite)
  trackingMetric: "Count", // "Count" or "Value"
  assignId: "user_123", // User ID or "everyone"
  period: "Monthly", // "Monthly", "Quarterly", "Yearly"
  description: "Deals progressed to Qualified stage",
};

console.log(JSON.stringify(basicProgressedGoal, null, 2));

// =============== VALIDATION RULES ===============
console.log("\n2. VALIDATION RULES FOR PROGRESSED GOALS:");
console.log(`
REQUIRED VALIDATION:
✅ entity === "Deal" (Progressed goals only work with deals)
✅ goalType === "Progressed" 
✅ startDate is provided and valid
✅ targetValue is provided and > 0
✅ pipeline is provided (pipeline name from your system)
✅ pipelineStage is provided (stage name from the pipeline)

OPTIONAL VALIDATION:
• endDate: If provided, must be after startDate
• trackingMetric: "Count" (default) or "Value"
• assignId: Valid user ID or "everyone" (default)
• period: "Monthly" (default), "Quarterly", or "Yearly"
`);

// =============== DIFFERENT VARIATIONS ===============
console.log("3. DIFFERENT VARIATIONS OF PROGRESSED GOALS:");

const variations = [
  {
    name: "Count-Based Progressed Goal",
    description: "Track number of deals entering specific stage",
    body: {
      entity: "Deal",
      goalType: "Progressed",
      startDate: "2025-08-01",
      endDate: "2025-08-31",
      targetValue: 25,
      trackingMetric: "Count",
      pipeline: "Sales Pipeline",
      pipelineStage: "Contact Made",
      assignId: "everyone",
      description: "25 deals should progress to Contact Made stage",
    },
  },
  {
    name: "Value-Based Progressed Goal",
    description: "Track total value of deals entering specific stage",
    body: {
      entity: "Deal",
      goalType: "Progressed",
      startDate: "2025-08-01",
      endDate: "2025-08-31",
      targetValue: 500000,
      trackingMetric: "Value",
      pipeline: "Enterprise Sales",
      pipelineStage: "Proposal Made",
      assignId: "user_456",
      description: "$500K in deals should progress to Proposal Made",
    },
  },
  {
    name: "Indefinite Progressed Goal",
    description: "Ongoing goal without end date",
    body: {
      entity: "Deal",
      goalType: "Progressed",
      startDate: "2025-08-01",
      endDate: null, // Indefinite goal
      targetValue: 10,
      trackingMetric: "Count",
      pipeline: "SMB Sales",
      pipelineStage: "Negotiations Started",
      assignId: "user_789",
      period: "Monthly",
      description: "Ongoing: 10 deals per month to Negotiations",
    },
  },
  {
    name: "Team-Based Progressed Goal",
    description: "Goal for entire team",
    body: {
      entity: "Deal",
      goalType: "Progressed",
      startDate: "2025-08-01",
      endDate: "2025-11-30",
      targetValue: 100,
      trackingMetric: "Count",
      pipeline: "Climate Change",
      pipelineStage: "Won",
      assignId: "everyone", // Track for all users
      period: "Quarterly",
      description: "Q3-Q4: 100 deals should be won in Climate Change pipeline",
    },
  },
];

variations.forEach((variation, index) => {
  console.log(`\n3.${index + 1} ${variation.name}:`);
  console.log(`Description: ${variation.description}`);
  console.log("Request Body:");
  console.log(JSON.stringify(variation.body, null, 2));
});

console.log("\n" + "=".repeat(80));
console.log("=== API RESPONSE FOR CREATE PROGRESSED GOALS ===");
console.log(`
SUCCESSFUL RESPONSE:
{
  "success": true,
  "message": "Goal created successfully",
  "data": {
    "goalId": 123,
    "entity": "Deal",
    "goalType": "Progressed",
    "targetValue": 50,
    "targetType": "number",
    "period": "Monthly",
    "startDate": "2025-08-01T00:00:00.000Z",
    "endDate": "2025-08-31T23:59:59.999Z",
    "description": "Deals progressed to Qualified stage",
    "assignee": null,
    "assignId": "user_123",
    "pipeline": "Climate Change",
    "pipelineStage": "Qualified",        // NEW FIELD
    "trackingMetric": "Count",
    "count": 50,
    "value": null,
    "isActive": true,
    "ownerId": 52,
    "createdAt": "2025-08-01T12:00:00.000Z",
    "updatedAt": "2025-08-01T12:00:00.000Z",
    "isIndefinite": false,
    "durationInfo": "Goal from 8/1/2025 to 8/31/2025"
  }
}

ERROR RESPONSES:
{
  "success": false,
  "message": "Pipeline is required for 'Progressed' deal goals"
}

{
  "success": false, 
  "message": "Pipeline stage is required for 'Progressed' deal goals"
}
`);

module.exports = { basicProgressedGoal, variations };
