const { Op } = require("sequelize");

console.log("Testing Sequelize operator symbols...");

// Test 1: Direct symbol usage
const condition1 = {
  type: {
    [Op.eq]: "Task",
  },
};
console.log("Direct Op.eq usage:", JSON.stringify(condition1, null, 2));
console.log("Op.eq symbol:", Op.eq);

// Test 2: Dynamic symbol resolution
const ops = {
  eq: Op.eq,
  ne: Op.ne,
  like: Op.like,
};

const operator = "eq";
const finalOperator = ops[operator];
const condition2 = {
  type: {
    [finalOperator]: "Task",
  },
};
console.log(
  "Dynamic operator resolution:",
  JSON.stringify(condition2, null, 2)
);
console.log("finalOperator:", finalOperator);

// Test 3: Check if Op.and works
const activityWhere = {};
activityWhere[Op.and] = [];
activityWhere[Op.and].push(condition2);

console.log(
  "Activity where with Op.and:",
  JSON.stringify(activityWhere, null, 2)
);
console.log("activityWhere[Op.and]:", activityWhere[Op.and]);
console.log("Object.keys(activityWhere):", Object.keys(activityWhere));
console.log("activityWhere has Op.and:", activityWhere.hasOwnProperty(Op.and));

// Test 4: Check if we can check for conditions properly
const hasActivityFilters =
  Object.keys(activityWhere).length > 0 ||
  (activityWhere[Op.and] && activityWhere[Op.and].length > 0);
console.log("hasActivityFilters:", hasActivityFilters);
