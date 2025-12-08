const sequelize = require('./config/db');
const Deal = require('./models/deals/dealsModels');
const DealProduct = require('./models/product/dealProductModel');
const Product = require('./models/product/productModel');
const LeadFilter = require('./models/leads/leadFiltersModel');
const { Op } = require('sequelize');

// Simulate buildCondition function
function buildCondition(condition) {
  const { field, operator, value } = condition;
  
  let op;
  switch (operator) {
    case 'is':
      op = Op.eq;
      break;
    case 'is not':
      op = Op.ne;
      break;
    case 'contains':
      op = Op.like;
      return { [field]: { [op]: `%${value}%` } };
    default:
      op = Op.eq;
  }
  
  return { [field]: { [op]: value } };
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    // Fetch filter 102
    const filter = await LeadFilter.findByPk(102);
    if (!filter) {
      console.log('❌ Filter 102 not found');
      process.exit(1);
    }

    console.log('📋 Filter 102 Configuration:');
    console.log('   Name:', filter.filterName);
    console.log('   Entity Type:', filter.filterEntityType);
    
    let filterConfig = filter.filterConfig;
    // Parse multi-level stringified JSON
    while (typeof filterConfig === 'string') {
      filterConfig = JSON.parse(filterConfig);
    }
    
    console.log('   Config:', JSON.stringify(filterConfig, null, 2));

    const { all = [], any = [] } = filterConfig;
    
    // Simulate the filtering logic
    const dealProductFields = Object.keys(DealProduct.rawAttributes);
    const productFields = Object.keys(Product.rawAttributes);
    
    console.log('\n📦 Available Product fields:', productFields.slice(0, 10).join(', '), '...');
    console.log('📦 Available DealProduct fields:', dealProductFields.slice(0, 10).join(', '), '...');

    let dealProductWhere = {};
    let productWhere = {};

    console.log('\n🔍 Processing filter conditions:');
    
    // Process 'all' conditions
    if (all.length > 0) {
      dealProductWhere[Op.and] = [];
      productWhere[Op.and] = [];

      all.forEach((cond, index) => {
        console.log(`\n   Condition ${index + 1}:`, cond);
        console.log(`      entity: "${cond.entity}"`);
        console.log(`      field: "${cond.field}"`);
        console.log(`      operator: "${cond.operator}"`);
        console.log(`      value: "${cond.value}"`);
        
        if (dealProductFields.includes(cond.field)) {
          console.log(`      ✅ Field '${cond.field}' found in DealProduct fields`);
          const condition = buildCondition(cond);
          dealProductWhere[Op.and].push(condition);
          console.log(`      Built condition:`, condition);
        } else if (productFields.includes(cond.field)) {
          console.log(`      ✅ Field '${cond.field}' found in Product fields`);
          const condition = buildCondition(cond);
          productWhere[Op.and].push(condition);
          console.log(`      Built condition:`, condition);
        } else {
          console.log(`      ❌ Field '${cond.field}' NOT found in product-related fields`);
        }
      });

      if (dealProductWhere[Op.and].length === 0) delete dealProductWhere[Op.and];
      if (productWhere[Op.and].length === 0) delete productWhere[Op.and];
    }

    console.log('\n📊 Final WHERE clauses:');
    console.log('   dealProductWhere:', JSON.stringify(dealProductWhere, null, 2));
    console.log('   productWhere:', JSON.stringify(productWhere, null, 2));
    console.log('   dealProductWhere keys:', Object.keys(dealProductWhere).length);
    console.log('   productWhere keys:', Object.keys(productWhere).length);
    console.log('   dealProductWhere Symbol keys:', Object.getOwnPropertySymbols(dealProductWhere).length);
    console.log('   productWhere Symbol keys:', Object.getOwnPropertySymbols(productWhere).length);

    // Build the include
    let include = [];
    
    // Check for Symbol keys as well (Op.and, Op.or are Symbols)
    const hasDealProductWhere = Object.getOwnPropertySymbols(dealProductWhere).length > 0 || Object.keys(dealProductWhere).length > 0;
    const hasProductWhere = Object.getOwnPropertySymbols(productWhere).length > 0 || Object.keys(productWhere).length > 0;
    
    console.log('   hasDealProductWhere:', hasDealProductWhere);
    console.log('   hasProductWhere:', hasProductWhere);
    
    if (hasDealProductWhere || hasProductWhere) {
      console.log('\n✅ Building product include with filtering...');
      
      const dealProductInclude = {
        model: DealProduct,
        as: "products",
        required: true, // INNER JOIN
      };

      if (Object.keys(dealProductWhere).length > 0) {
        dealProductInclude.where = dealProductWhere;
        console.log('   Added dealProduct WHERE clause');
      }

      if (Object.keys(productWhere).length > 0) {
        dealProductInclude.include = [
          {
            model: Product,
            as: "product",
            where: productWhere,
            required: true,
          },
        ];
        console.log('   Added nested Product WHERE clause with required: true');
      }

      include.push(dealProductInclude);
      console.log('\n📝 Final include structure:', JSON.stringify(include, null, 2));
    } else {
      console.log('\n❌ No product filtering - both WHERE objects are empty!');
    }

    // Execute the query
    console.log('\n🔎 Executing query...');
    const deals = await Deal.findAll({
      where: {}, // Simplified - no other filters
      include,
      attributes: ['dealId', 'title', 'contactPerson', 'organization'],
      limit: 10
    });

    console.log(`\n✅ Query executed. Found ${deals.length} deal(s):\n`);
    deals.forEach((deal, index) => {
      console.log(`${index + 1}. Deal ${deal.dealId}: "${deal.title}"`);
      console.log(`   Contact: ${deal.contactPerson}`);
      console.log(`   Organization: ${deal.organization}`);
      if (deal.products && deal.products.length > 0) {
        console.log(`   Products: ${deal.products.length}`);
        deal.products.forEach(dp => {
          console.log(`      - ${dp.product?.name || 'Unknown'} (Qty: ${dp.quantity})`);
        });
      } else {
        console.log(`   Products: 0`);
      }
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
