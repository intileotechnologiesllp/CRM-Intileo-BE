const sequelize = require('./config/db');
const Product = require('./models/product/productModel');
const DealProduct = require('./models/product/dealProductModel');
const Deal = require('./models/deals/dealsModels');
const { Op } = require('sequelize');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    // Check for products with name "shirt"
    console.log('=== Searching for product with name "shirt" ===');
    const shirtProducts = await Product.findAll({
      where: { name: 'shirt' },
      attributes: ['productId', 'name', 'code']
    });

    if (shirtProducts.length === 0) {
      console.log('❌ No products found with name "shirt"\n');
    } else {
      console.log(`✅ Found ${shirtProducts.length} product(s) with name "shirt":\n`);
      shirtProducts.forEach(p => {
        console.log(`   Product ${p.productId}: "${p.name}" (${p.code})`);
      });
      console.log('');
    }

    // Show all products for reference
    console.log('=== All Products in Database ===');
    const allProducts = await Product.findAll({
      attributes: ['productId', 'name', 'code'],
      order: [['productId', 'ASC']]
    });

    if (allProducts.length === 0) {
      console.log('❌ No products in database');
    } else {
      console.log(`✅ Total products: ${allProducts.length}\n`);
      allProducts.forEach(p => {
        console.log(`   Product ${p.productId}: "${p.name}" (${p.code})`);
      });
    }
    console.log('');

    // Check all deal-product associations
    console.log('=== All Deal-Product Associations ===');
    const dealProducts = await DealProduct.findAll({
      include: [
        {
          model: Deal,
          as: 'deal',
          attributes: ['dealId', 'title', 'contactPerson']
        },
        {
          model: Product,
          as: 'product',
          attributes: ['productId', 'name', 'code']
        }
      ],
      order: [['dealId', 'ASC']]
    });

    if (dealProducts.length === 0) {
      console.log('❌ No deal-product associations found\n');
    } else {
      console.log(`✅ Found ${dealProducts.length} association(s):\n`);
      dealProducts.forEach(dp => {
        console.log(`   Deal ${dp.dealId}: "${dp.deal?.title}" (${dp.deal?.contactPerson})`);
        console.log(`      → Product ${dp.productId}: "${dp.product?.name}" (${dp.product?.code})`);
        console.log('');
      });
    }

    // Now test the filter logic
    console.log('=== Testing Filter 103 Logic ===');
    console.log('Filter condition: product.name = "shirt"\n');

    // Simulate the filter query
    const productWhere = {
      [Op.and]: [{
        name: { [Op.eq]: 'shirt' }
      }]
    };

    const dealsWithShirt = await Deal.findAll({
      include: [
        {
          model: DealProduct,
          as: 'products',
          required: true, // INNER JOIN
          include: [
            {
              model: Product,
              as: 'product',
              where: productWhere,
              required: true
            }
          ]
        }
      ],
      attributes: ['dealId', 'title', 'contactPerson']
    });

    console.log(`Query result: Found ${dealsWithShirt.length} deal(s) with product "shirt"\n`);
    
    if (dealsWithShirt.length > 0) {
      dealsWithShirt.forEach(deal => {
        console.log(`   Deal ${deal.dealId}: "${deal.title}" (${deal.contactPerson})`);
      });
    } else {
      console.log('   ✅ No deals found (expected since no product "shirt" exists)');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
