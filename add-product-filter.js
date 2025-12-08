const fs = require('fs');
const path = require('path');

const filePath = './controllers/leads/leadContactController.js';
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the first occurrence of the function
let firstFunctionLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('exports.getPersonsAndOrganizations = async')) {
    firstFunctionLine = i;
    console.log('✅ Found function at line:', firstFunctionLine + 1);
    break;
  }
}

if (firstFunctionLine === -1) {
  console.log('❌ Function not found');
  process.exit(1);
}

// Step 1: Add Product model loading after Activity model loading
let activityFieldsLine = -1;
for (let i = firstFunctionLine; i < Math.min(firstFunctionLine + 500, lines.length); i++) {
  if (lines[i].includes('Activity model not available')) {
    activityFieldsLine = i;
    console.log('✅ Found Activity fields section at line:', activityFieldsLine + 1);
    break;
  }
}

if (activityFieldsLine !== -1) {
  const productCode = [
    '',
    '    let productFields = [];',
    '    let dealProductFields = [];',
    '    try {',
    '      const Product = require("../../models/product/productModel");',
    '      const DealProduct = require("../../models/product/dealProductModel");',
    '      productFields = Object.keys(Product.rawAttributes);',
    '      dealProductFields = Object.keys(DealProduct.rawAttributes);',
    '    } catch (e) {',
    '      console.log("[DEBUG] Product models not available:", e.message);',
    '    }'
  ];
  
  lines.splice(activityFieldsLine + 1, 0, ...productCode);
  console.log('✅ Added Product and DealProduct field loading');
  
  // Add debug logging
  let debugLogLine = -1;
  for (let i = activityFieldsLine + productCode.length + 5; i < Math.min(activityFieldsLine + productCode.length + 25, lines.length); i++) {
    if (lines[i].includes('"- Activity fields:"')) {
      debugLogLine = i;
      console.log('✅ Found debug log line at:', debugLogLine + 1);
      break;
    }
  }
  
  if (debugLogLine !== -1) {
    lines.splice(debugLogLine + 1, 0, 
      '    console.log("- Product fields:", productFields.slice(0, 5), "...");',
      '    console.log("- DealProduct fields:", dealProductFields.slice(0, 5), "...");'
    );
    console.log('✅ Added Product debug logging');
  }
}

// Step 2: Add product cases to switch statement (AND conditions)
let switchCaseLine = -1;
for (let i = firstFunctionLine; i < Math.min(firstFunctionLine + 700, lines.length); i++) {
  if (lines[i].includes('case "activity":') && lines[i-1].includes('break;')) {
    switchCaseLine = i;
    console.log('✅ Found activity case at line:', switchCaseLine + 1);
    break;
  }
}

if (switchCaseLine !== -1) {
  // Find the end of activity case
  let activityCaseEnd = -1;
  for (let i = switchCaseLine; i < Math.min(switchCaseLine + 50, lines.length); i++) {
    if (lines[i].includes('break;') && lines[i].trim() === 'break;') {
      activityCaseEnd = i;
      break;
    }
  }
  
  if (activityCaseEnd !== -1) {
    const productCases = [
      '              case "product":',
      '                if (productFields.includes(cond.field)) {',
      '                  if (!productWhere[Op.and]) productWhere[Op.and] = [];',
      '                  productWhere[Op.and].push(buildCondition(cond));',
      '                  console.log(',
      '                    `[DEBUG] Added Product AND condition for field: ${cond.field}`',
      '                  );',
      '                }',
      '                break;',
      '              case "dealproduct":',
      '                if (dealProductFields.includes(cond.field)) {',
      '                  if (!dealProductWhere[Op.and]) dealProductWhere[Op.and] = [];',
      '                  dealProductWhere[Op.and].push(buildCondition(cond));',
      '                  console.log(',
      '                    `[DEBUG] Added DealProduct AND condition for field: ${cond.field}`',
      '                  );',
      '                }',
      '                break;'
    ];
    
    lines.splice(activityCaseEnd + 1, 0, ...productCases);
    console.log('✅ Added Product and DealProduct AND cases to switch statement');
  }
}

// Step 3: Add product cases to OR conditions switch statement
let orSwitchCaseLine = -1;
for (let i = switchCaseLine + 200; i < Math.min(firstFunctionLine + 1000, lines.length); i++) {
  if (lines[i].includes('case "activity":') && 
      lines[i-1].includes('break;') &&
      i > switchCaseLine + 100) {
    orSwitchCaseLine = i;
    console.log('✅ Found OR activity case at line:', orSwitchCaseLine + 1);
    break;
  }
}

if (orSwitchCaseLine !== -1) {
  let orActivityCaseEnd = -1;
  for (let i = orSwitchCaseLine; i < Math.min(orSwitchCaseLine + 50, lines.length); i++) {
    if (lines[i].includes('break;') && lines[i].trim() === 'break;') {
      orActivityCaseEnd = i;
      break;
    }
  }
  
  if (orActivityCaseEnd !== -1) {
    const productOrCases = [
      '              case "product":',
      '                if (productFields.includes(cond.field)) {',
      '                  if (!productWhere[Op.or]) productWhere[Op.or] = [];',
      '                  productWhere[Op.or].push(buildCondition(cond));',
      '                  console.log(',
      '                    `[DEBUG] Added Product OR condition for field: ${cond.field}`',
      '                  );',
      '                }',
      '                break;',
      '              case "dealproduct":',
      '                if (dealProductFields.includes(cond.field)) {',
      '                  if (!dealProductWhere[Op.or]) dealProductWhere[Op.or] = [];',
      '                  dealProductWhere[Op.or].push(buildCondition(cond));',
      '                  console.log(',
      '                    `[DEBUG] Added DealProduct OR condition for field: ${cond.field}`',
      '                  );',
      '                }',
      '                break;'
    ];
    
    lines.splice(orActivityCaseEnd + 1, 0, ...productOrCases);
    console.log('✅ Added Product and DealProduct OR cases to switch statement');
  }
}

// Step 4: Add product where clauses to debug logging
let whereDebugLine = -1;
for (let i = firstFunctionLine; i < Math.min(firstFunctionLine + 1100, lines.length); i++) {
  if (lines[i].includes('"- activityWhere:"')) {
    whereDebugLine = i;
    console.log('✅ Found where debug logging at line:', whereDebugLine + 1);
    break;
  }
}

if (whereDebugLine !== -1) {
  lines.splice(whereDebugLine + 1, 0,
    '    console.log("- productWhere:", JSON.stringify(productWhere, null, 2));',
    '    console.log("- dealProductWhere:", JSON.stringify(dealProductWhere, null, 2));'
  );
  console.log('✅ Added productWhere debug logging');
}

// Step 5: Add product filter detection flags
let filterDetectionLine = -1;
for (let i = firstFunctionLine; i < Math.min(firstFunctionLine + 1200, lines.length); i++) {
  if (lines[i].includes('hasOrgFilters =') && lines[i].includes('organizationWhere')) {
    filterDetectionLine = i;
    console.log('✅ Found filter detection at line:', filterDetectionLine + 1);
    break;
  }
}

if (filterDetectionLine !== -1) {
  lines.splice(filterDetectionLine + 1, 0,
    '    const hasProductFilters =',
    '      Object.keys(productWhere).length > 0 ||',
    '      (productWhere[Op.and] && productWhere[Op.and].length > 0);',
    '    const hasDealProductFilters =',
    '      Object.keys(dealProductWhere).length > 0 ||',
    '      (dealProductWhere[Op.and] && dealProductWhere[Op.and].length > 0);'
  );
  console.log('✅ Added product filter detection');
  
  // Update debug logging
  let filterDetectionDebugLine = -1;
  for (let i = filterDetectionLine + 10; i < Math.min(filterDetectionLine + 30, lines.length); i++) {
    if (lines[i].includes('"- hasOrgFilters:"')) {
      filterDetectionDebugLine = i;
      break;
    }
  }
  
  if (filterDetectionDebugLine !== -1) {
    lines.splice(filterDetectionDebugLine + 1, 0,
      '    console.log("- hasProductFilters:", hasProductFilters);',
      '    console.log("- hasDealProductFilters:", hasDealProductFilters);'
    );
    console.log('✅ Added product filter detection debug logging');
  }
}

// Save the modified file
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('\n✅ File modified successfully!');
console.log('\n📝 Next steps:');
console.log('1. Restart your server');
console.log('2. The API will now recognize "product" and "dealproduct" entities');
console.log('3. However, you still need to add the product filter application logic');
console.log('4. Refer to PRODUCT_FILTER_PERSON_API_CHANGES.md for Step 6-9');
