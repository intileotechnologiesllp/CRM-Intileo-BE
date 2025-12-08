const Deal = require('./models/deals/dealsModels');
const DealProduct = require('./models/product/dealProductModel');
const Product = require('./models/product/productModel');
const LeadFilter = require('./models/leads/leadFiltersModel');
const { Op } = require('sequelize');
const sequelize = require('./config/db');

async function testProductFilter() {
  try {
    console.log('🔍 Testing Product Filter in getDeals (Updated)\n');
    
    // Get the filter
    const filter = await LeadFilter.findByPk(101);
    console.log('Filter:', filter.filterName);
    console.log('Filter Config:', filter.filterConfig);
    
    let filterConfig = filter.filterConfig;
    
    // Handle double-stringified JSON
    if (typeof filterConfig === 'string') {
      filterConfig = JSON.parse(filterConfig);
    }
    if (typeof filterConfig === 'string') {
      filterConfig = JSON.parse(filterConfig);
    }
    
    console.log('\nParsed filter config:', JSON.stringify(filterConfig, null, 2));
    
    const { all = [], any = [] } = filterConfig;
    
    // Check product fields
    const productFields = Product ? Object.keys(Product.rawAttributes) : [];
    console.log('\nAvailable Product fields:', productFields);
    
    // Process conditions
    console.log('\nProcessing ALL conditions:');
    all.forEach(cond => {
      console.log(`  - Field: ${cond.field}, Operator: ${cond.operator}, Value: ${cond.value}`);
      console.log(`    Is in Product fields? ${productFields.includes(cond.field)}`);
    });
    
    // Build WHERE clause for products
    let productWhere = {};
    if (all.length > 0) {
      productWhere[Op.and] = [];
      all.forEach(cond => {
        if (productFields.includes(cond.field)) {
          const condition = buildCondition(cond);
          console.log('\n  Built condition:', JSON.stringify(condition, null, 2));
          productWhere[Op.and].push(condition);
        }
      });
    }
    
    console.log('\nProduct WHERE clause:', JSON.stringify(productWhere, null, 2));
    
    // Find products matching the filter
    console.log('\n=== Finding Products Matching Filter ===');
    const matchingProducts = await Product.findAll({
      where: productWhere,
      attributes: ['productId', 'name', 'code']
    });
    
    console.log('Matching products:', matchingProducts.length);
    matchingProducts.forEach(p => {
      console.log(`  - Product ${p.productId}: ${p.name} (${p.code})`);
    });
    
    // Find deals with these products
    if (matchingProducts.length > 0) {
      const productIds = matchingProducts.map(p => p.productId);
      console.log('\n=== Finding Deals with These Products ===');
      console.log('Product IDs:', productIds);
      
      const dealsWithProducts = await DealProduct.findAll({
        where: { productId: { [Op.in]: productIds } },
        attributes: ['dealId', 'productId', 'quantity', 'total'],
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['productId', 'name']
          }
        ]
      });
      
      console.log('Deals with matching products:', dealsWithProducts.length);
      dealsWithProducts.forEach(dp => {
        console.log(`  - Deal ${dp.dealId}: Product ${dp.product.name} (Qty: ${dp.quantity}, Total: ${dp.total})`);
      });
      
      const dealIds = [...new Set(dealsWithProducts.map(dp => dp.dealId))];
      console.log('\nUnique Deal IDs:', dealIds);
      
      // Fetch these deals
      const deals = await Deal.findAll({
        where: { dealId: { [Op.in]: dealIds } },
        attributes: ['dealId', 'title', 'contactPerson', 'value']
      });
      
      console.log('\n=== Final Deals ===');
      deals.forEach(deal => {
        console.log(`  - Deal ${deal.dealId}: ${deal.title} (${deal.contactPerson}) - Value: ${deal.value}`);
      });
    } else {
      console.log('\n❌ No products match the filter criteria');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Helper function from dealsController
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

  if (operatorMap[operator]) {
    operator = operatorMap[operator];
  }

  // Handle "is empty" and "is not empty"
  if (operator === "is empty") {
    return { [cond.field]: { [Op.is]: null } };
  }
  if (operator === "is not empty") {
    return { [cond.field]: { [Op.not]: null, [Op.ne]: "" } };
  }

  // Default
  return {
    [cond.field]: {
      [ops[operator] || Op.eq]: cond.value,
    },
  };
}

testProductFilter();
