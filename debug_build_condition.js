const { Op } = require('sequelize');

function buildCondition(cond) {
  const ops = {
    eq: Op.eq,
    ne: Op.ne,
    like: Op.like,
    notLike: Op.notLike,
    gt: Op.gt,
    gte: Op.gte,
    lt: Op.lt,
    lte: Op.lte,
    in: Op.in,
    notIn: Op.notIn,
    is: Op.eq,
    isNot: Op.ne,
    isEmpty: Op.is,
    isNotEmpty: Op.not,
  };

  let operator = cond.operator;
  const operatorMap = {
    is: "eq",
    "is not": "ne",
    "is empty": "is empty",
    "is not empty": "is not empty",
  };

  console.log('Input condition:', JSON.stringify(cond, null, 2));
  console.log('Original operator:', operator);

  if (operatorMap[operator]) {
    operator = operatorMap[operator];
    console.log('Mapped operator:', operator);
  }

  // Handle "is empty" and "is not empty"
  if (operator === "is empty") {
    return { [cond.field]: { [Op.is]: null } };
  }
  if (operator === "is not empty") {
    return { [cond.field]: { [Op.not]: null, [Op.ne]: "" } };
  }

  // Default
  const result = {
    [cond.field]: {
      [ops[operator] || Op.eq]: cond.value,
    },
  };
  
  console.log('Built condition:', JSON.stringify(result, null, 2));
  console.log('Operator used:', ops[operator]);
  console.log('Op.eq symbol:', Op.eq);
  
  return result;
}

// Test the condition building
const testCondition = {
  "entity": "product",
  "field": "name",
  "operator": "is",
  "value": "Website Develo",
  "useExactDate": false,
  "fieldType": "text"
};

console.log('=== Testing buildCondition ===\n');
const result = buildCondition(testCondition);
console.log('\nFinal result:', result);
console.log('Result with Symbol keys:', Object.getOwnPropertySymbols(result.name));
