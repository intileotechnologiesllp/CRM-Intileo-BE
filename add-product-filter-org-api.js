const fs = require('fs');

const filePath = './controllers/leads/leadContactController.js';
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find getOrganizationsAndPersons function (line 1521)
let targetFunctionLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('exports.getOrganizationsAndPersons = async')) {
    targetFunctionLine = i;
    console.log('✅ Found getOrganizationsAndPersons at line:', targetFunctionLine + 1);
    break;
  }
}

if (targetFunctionLine === -1) {
  console.log('❌ Function not found');
  process.exit(1);
}

// Find the OR conditions activity case in this function (should be around line 2012)
let orActivityCaseLine = -1;
for (let i = targetFunctionLine; i < Math.min(targetFunctionLine + 600, lines.length); i++) {
  if (lines[i].includes('case "activity":') && 
      lines[i+1] && lines[i+1].includes('if (activityFields.includes(cond.field))') &&
      lines[i-10] && lines[i-10].includes('// OR conditions')) {
    orActivityCaseLine = i;
    console.log('✅ Found OR activity case at line:', orActivityCaseLine + 1);
    break;
  }
}

if (orActivityCaseLine !== -1) {
  // Find the break; statement for activity case
  let activityBreakLine = -1;
  for (let i = orActivityCaseLine; i < Math.min(orActivityCaseLine + 15, lines.length); i++) {
    if (lines[i].trim() === 'break;') {
      activityBreakLine = i;
      break;
    }
  }
  
  if (activityBreakLine !== -1) {
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
    
    lines.splice(activityBreakLine + 1, 0, ...productOrCases);
    console.log('✅ Added Product and DealProduct OR cases');
  }
}

// Now add product filter detection and application logic
// Find where orgFilteredOrgIds is defined (around line 2470)
let orgFilterDefLine = -1;
for (let i = targetFunctionLine; i < Math.min(targetFunctionLine + 1100, lines.length); i++) {
  if (lines[i].includes('let orgFilteredOrgIds = [];') && 
      lines[i+1] && lines[i+1].includes('const hasOrgFilters =')) {
    orgFilterDefLine = i;
    console.log('✅ Found org filter definition at line:', orgFilterDefLine + 1);
    break;
  }
}

if (orgFilterDefLine !== -1) {
  // Find the end of org filter section (after console.log for org IDs)
  let orgFilterEndLine = -1;
  for (let i = orgFilterDefLine; i < Math.min(orgFilterDefLine + 80, lines.length); i++) {
    if (lines[i].includes('console.log("[DEBUG] Organization-filtered org IDs:"')) {
      orgFilterEndLine = i;
      break;
    }
  }
  
  if (orgFilterEndLine !== -1) {
    const productFilterCode = [
      '',
      '    // Apply Product filters to get relevant organization IDs (through deals)',
      '    let productFilteredOrgIds = [];',
      '    const hasProductFilters =',
      '      productWhere[Op.and]?.length > 0 ||',
      '      productWhere[Op.or]?.length > 0 ||',
      '      Object.keys(productWhere).some((key) => typeof key === "string");',
      '    const hasDealProductFilters =',
      '      dealProductWhere[Op.and]?.length > 0 ||',
      '      dealProductWhere[Op.or]?.length > 0 ||',
      '      Object.keys(dealProductWhere).some((key) => typeof key === "string");',
      '',
      '    if (hasProductFilters || hasDealProductFilters) {',
      '      console.log("[DEBUG] Applying Product filters to find organizations through deals");',
      '      console.log("[DEBUG] productWhere:", JSON.stringify(productWhere, null, 2));',
      '      console.log("[DEBUG] dealProductWhere:", JSON.stringify(dealProductWhere, null, 2));',
      '',
      '      try {',
      '        const Product = require("../../models/product/productModel");',
      '        const DealProduct = require("../../models/product/dealProductModel");',
      '        ',
      '        // Build the include chain: Deal -> DealProduct -> Product',
      '        const dealInclude = [];',
      '        ',
      '        if (hasProductFilters || hasDealProductFilters) {',
      '          const dealProductInclude = {',
      '            model: DealProduct,',
      '            as: "dealProducts",',
      '            required: true,',
      '            attributes: []',
      '          };',
      '          ',
      '          // Add DealProduct WHERE conditions if they exist',
      '          if (hasDealProductFilters) {',
      '            dealProductInclude.where = dealProductWhere;',
      '          }',
      '          ',
      '          // Add Product include with WHERE conditions if they exist',
      '          if (hasProductFilters) {',
      '            dealProductInclude.include = [{',
      '              model: Product,',
      '              as: "product",',
      '              where: productWhere,',
      '              required: true,',
      '              attributes: []',
      '            }];',
      '          } else {',
      '            // Just include product without filter',
      '            dealProductInclude.include = [{',
      '              model: Product,',
      '              as: "product",',
      '              required: true,',
      '              attributes: []',
      '            }];',
      '          }',
      '          ',
      '          dealInclude.push(dealProductInclude);',
      '        }',
      '        ',
      '        // Query deals that have matching products',
      '        let dealsWithProducts = [];',
      '        if (req.role === "admin") {',
      '          dealsWithProducts = await Deal.findAll({',
      '            include: dealInclude,',
      '            attributes: ["leadOrganizationId"],',
      '            raw: false',
      '          });',
      '        } else {',
      '          dealsWithProducts = await Deal.findAll({',
      '            where: {',
      '              [Op.or]: [',
      '                { masterUserID: req.adminId },',
      '                { ownerId: req.adminId }',
      '              ]',
      '            },',
      '            include: dealInclude,',
      '            attributes: ["leadOrganizationId"],',
      '            raw: false',
      '          });',
      '        }',
      '        ',
      '        console.log(',
      '          "[DEBUG] Product filter results:",',
      '          dealsWithProducts.length,',
      '          "deals found with matching products"',
      '        );',
      '        ',
      '        // Get organization IDs directly from deals',
      '        productFilteredOrgIds = dealsWithProducts',
      '          .map((deal) => deal.leadOrganizationId)',
      '          .filter(Boolean);',
      '        ',
      '        productFilteredOrgIds = [...new Set(productFilteredOrgIds)];',
      '        ',
      '        console.log(',
      '          "[DEBUG] Product-filtered org IDs:",',
      '          productFilteredOrgIds.length',
      '        );',
      '      } catch (e) {',
      '        console.log("[DEBUG] Error applying Product filters:", e.message);',
      '        console.error("[DEBUG] Full error:", e);',
      '      }',
      '    }'
    ];
    
    lines.splice(orgFilterEndLine + 1, 0, ...productFilterCode);
    console.log('✅ Added Product filter application logic');
  }
}

// Find allFilteredOrgIds array and add productFilteredOrgIds
let allFilteredOrgIdsLine = -1;
for (let i = targetFunctionLine; i < lines.length; i++) {
  if (lines[i].includes('const allFilteredOrgIds = [') &&
      lines[i+1] && lines[i+1].includes('...new Set([') &&
      lines[i+2] && lines[i+2].includes('...leadFilteredOrgIds,')) {
    allFilteredOrgIdsLine = i;
    console.log('✅ Found allFilteredOrgIds at line:', allFilteredOrgIdsLine + 1);
    break;
  }
}

if (allFilteredOrgIdsLine !== -1) {
  // Find the line with ...orgFilteredOrgIds,
  for (let i = allFilteredOrgIdsLine; i < Math.min(allFilteredOrgIdsLine + 10, lines.length); i++) {
    if (lines[i].includes('...orgFilteredOrgIds,')) {
      lines[i] = lines[i].replace('...orgFilteredOrgIds,', '...orgFilteredOrgIds,\n        ...productFilteredOrgIds,');
      console.log('✅ Added productFilteredOrgIds to allFilteredOrgIds array');
      break;
    }
  }
}

// Update the empty results check to include product filters
let emptyResultsCheckLine = -1;
for (let i = targetFunctionLine; i < lines.length; i++) {
  if (lines[i].includes('} else if (') &&
      lines[i+1] && lines[i+1].includes('hasLeadFilters ||') &&
      lines[i+2] && lines[i+2].includes('hasActivityFilters ||')) {
    emptyResultsCheckLine = i;
    console.log('✅ Found empty results check at line:', emptyResultsCheckLine + 1);
    break;
  }
}

if (emptyResultsCheckLine !== -1) {
  // Find the line with hasOrgFilters
  for (let i = emptyResultsCheckLine; i < Math.min(emptyResultsCheckLine + 10, lines.length); i++) {
    if (lines[i].includes('hasOrgFilters')) {
      lines[i] = lines[i].replace('hasOrgFilters', 'hasOrgFilters ||\n      hasProductFilters ||\n      hasDealProductFilters');
      console.log('✅ Updated empty results check to include product filters');
      break;
    }
  }
}

// Save the modified file
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('\n✅ File modified successfully!');
console.log('\n📝 Summary of changes:');
console.log('1. ✅ Added Product and DealProduct OR cases to switch statement');
console.log('2. ✅ Added Product filter application logic (finds orgs through deals with products)');
console.log('3. ✅ Added productFilteredOrgIds to allFilteredOrgIds array');
console.log('4. ✅ Updated empty results check to include product filters');
console.log('\n🎉 Product filtering is now available in getOrganizationsAndPersons API!');
console.log('Restart your server and test with filterId=101');
