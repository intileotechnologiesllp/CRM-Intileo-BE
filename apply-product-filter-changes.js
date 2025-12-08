/**
 * Script to add Product Filtering to getPersonsAndOrganizations API
 * Run this with: node apply-product-filter-changes.js
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'controllers', 'leads', 'leadContactController.js');

console.log('📁 Reading file:', filePath);
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('📊 Total lines:', lines.length);

// Find the getPersonsAndOrganizations function
let functionStartLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('exports.getPersonsAndOrganizations = async')) {
    functionStartLine = i;
    console.log('✅ Found getPersonsAndOrganizations at line:', i + 1);
    break;
  }
}

if (functionStartLine === -1) {
  console.log('❌ Could not find getPersonsAndOrganizations function');
  process.exit(1);
}

// Find where to add product model loading (after Activity model loading)
let activityModelLine = -1;
for (let i = functionStartLine; i < lines.length; i++) {
  if (lines[i].includes('Activity model not available')) {
    activityModelLine = i;
    console.log('✅ Found Activity model section at line:', i + 1);
    break;
  }
}

if (activityModelLine !== -1) {
  // Add product model loading after Activity section
  const insertLine = activityModelLine + 2; // After the } of the catch block
  
  const productModelCode = `
    // Get product and dealProduct field names for product filtering
    let productFields = [];
    let dealProductFields = [];
    try {
      const Product = require("../../models/product/productModel");
      const DealProduct = require("../../models/product/dealProductModel");
      productFields = Object.keys(Product.rawAttributes);
      dealProductFields = Object.keys(DealProduct.rawAttributes);
    } catch (e) {
      console.log("[DEBUG] Product models not available:", e.message);
    }

    console.log("- Product fields:", productFields.slice(0, 5), "...");
    console.log("- DealProduct fields:", dealProductFields.slice(0, 5), "...");
`;

  lines.splice(insertLine, 0, productModelCode);
  console.log('✅ Added product model loading code');
}

// Find the switch statement for entity filtering
let switchLine = -1;
for (let i = functionStartLine; i < lines.length; i++) {
  if (lines[i].includes('case "activity":') && lines[i - 1].includes('break;')) {
    switchLine = i;
    console.log('✅ Found switch statement for entity filtering at line:', i + 1);
    break;
  }
}

if (switchLine !== -1) {
  // Find the end of activity case (before default case)
  let insertAfterLine = switchLine;
  for (let i = switchLine; i < switchLine + 50; i++) {
    if (lines[i].includes('default:')) {
      insertAfterLine = i;
      break;
    }
  }
  
  const productCases = `              case "product":
                if (productFields.includes(cond.field)) {
                  if (!productWhere[Op.and]) productWhere[Op.and] = [];
                  productWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    \`[DEBUG] Added Product AND condition for field: \${cond.field}\`
                  );
                }
                break;
              case "dealproduct":
                if (dealProductFields.includes(cond.field)) {
                  if (!dealProductWhere[Op.and]) dealProductWhere[Op.and] = [];
                  dealProductWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    \`[DEBUG] Added DealProduct AND condition for field: \${cond.field}\`
                  );
                }
                break;
`;

  lines.splice(insertAfterLine, 0, productCases);
  console.log('✅ Added product cases to switch statement');
}

// Write the modified content back
const newContent = lines.join('\n');
fs.writeFileSync(filePath, newContent, 'utf8');

console.log('');
console.log('✅ ===================================');
console.log('✅ Changes applied successfully!');
console.log('✅ ===================================');
console.log('');
console.log('⚠️  NOTE: This script added partial changes.');
console.log('⚠️  Please refer to PRODUCT_FILTER_PERSON_API_CHANGES.md');
console.log('⚠️  for the complete implementation guide.');
console.log('');
console.log('📝 Next steps:');
console.log('  1. Add product filter application logic');
console.log('  2. Add productFilteredPersonIds to allFilteredPersonIds');
console.log('  3. Test with product filters');
console.log('');
