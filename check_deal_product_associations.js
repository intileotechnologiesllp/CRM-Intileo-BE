const sequelize = require('./config/db');
const Deal = require('./models/deals/dealsModels');
const DealProduct = require('./models/product/dealProductModel');
const Product = require('./models/product/productModel');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Check all deal-product associations
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

    console.log('\n=== ALL DEAL-PRODUCT ASSOCIATIONS ===');
    if (dealProducts.length === 0) {
      console.log('❌ No products associated with any deals');
    } else {
      console.log(`✅ Found ${dealProducts.length} deal-product association(s):\n`);
      dealProducts.forEach((dp, index) => {
        console.log(`${index + 1}. Deal ${dp.dealId}: "${dp.deal?.title || 'Unknown'}"`);
        console.log(`   Contact: ${dp.deal?.contactPerson || 'Unknown'}`);
        console.log(`   Product ${dp.productId}: "${dp.product?.name || 'Unknown'}" (${dp.product?.code || 'N/A'})`);
        console.log(`   Quantity: ${dp.quantity}, Unit Price: ${dp.unitPrice}, Total: ${dp.total}`);
        console.log('');
      });
    }

    // Now check which products exist
    console.log('\n=== ALL PRODUCTS ===');
    const products = await Product.findAll({
      attributes: ['productId', 'name', 'code'],
      order: [['productId', 'ASC']]
    });

    if (products.length === 0) {
      console.log('❌ No products found');
    } else {
      console.log(`✅ Found ${products.length} product(s):\n`);
      products.forEach((product, index) => {
        console.log(`${index + 1}. Product ${product.productId}: "${product.name}" (${product.code})`);
      });
    }

    // Check specifically for "Website Development Service"
    console.log('\n=== CHECKING FOR "Website Development Service" ===');
    const targetProducts = await Product.findAll({
      where: {
        name: 'Website Development Service'
      },
      attributes: ['productId', 'name', 'code']
    });

    if (targetProducts.length === 0) {
      console.log('❌ No product found with name "Website Development Service"');
    } else {
      console.log(`✅ Found ${targetProducts.length} product(s) with name "Website Development Service":`);
      for (const product of targetProducts) {
        console.log(`   Product ${product.productId}: "${product.name}" (${product.code})`);
        
        // Check which deals have this product
        const dealsWithProduct = await DealProduct.findAll({
          where: { productId: product.productId },
          include: [{
            model: Deal,
            as: 'deal',
            attributes: ['dealId', 'title', 'contactPerson']
          }]
        });

        if (dealsWithProduct.length === 0) {
          console.log('   ⚠️ No deals associated with this product');
        } else {
          console.log(`   ✅ Associated with ${dealsWithProduct.length} deal(s):`);
          dealsWithProduct.forEach(dp => {
            console.log(`      - Deal ${dp.dealId}: "${dp.deal?.title}"`);
          });
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
