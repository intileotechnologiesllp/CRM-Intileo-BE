const DealProduct = require('./models/product/dealProductModel');
const Product = require('./models/product/productModel');
const sequelize = require('./config/db');

async function testAddProductToDeal() {
  try {
    console.log('Testing addProductToDeal...\n');
    
    // Test data
    const testData = {
      dealId: 344, // Using existing deal
      productId: 1, // Using existing product
      variationId: null,
      quantity: 2,
      unitPrice: 50000.00,
      currency: 'INR',
      discountType: 'percentage',
      discountValue: 10,
      taxType: 'tax-exclusive',
      taxPercentage: 18,
      billingFrequency: 'monthly',
      billingStartDate: new Date('2024-01-01'),
      billingEndDate: new Date('2024-12-31'),
      notes: 'Test product addition'
    };
    
    console.log('Test data:', JSON.stringify(testData, null, 2));
    
    // Calculate amounts (same logic as controller)
    const subtotal = parseFloat(testData.quantity) * parseFloat(testData.unitPrice);
    console.log('\nSubtotal:', subtotal);
    
    let discountAmount = 0;
    if (testData.discountType === 'percentage') {
      discountAmount = (subtotal * parseFloat(testData.discountValue)) / 100;
    } else if (testData.discountType === 'fixed') {
      discountAmount = parseFloat(testData.discountValue);
    }
    console.log('Discount amount:', discountAmount);
    
    const amountAfterDiscount = subtotal - discountAmount;
    console.log('Amount after discount:', amountAfterDiscount);
    
    let taxAmount = 0;
    let total = amountAfterDiscount;
    
    if (testData.taxType === 'tax-exclusive') {
      taxAmount = (amountAfterDiscount * parseFloat(testData.taxPercentage || 0)) / 100;
      total = amountAfterDiscount + taxAmount;
    } else if (testData.taxType === 'tax-inclusive') {
      taxAmount = (amountAfterDiscount * parseFloat(testData.taxPercentage || 0)) / (100 + parseFloat(testData.taxPercentage || 0));
      total = amountAfterDiscount;
    }
    
    console.log('Tax amount:', taxAmount);
    console.log('Total:', total);
    
    // Create deal product
    console.log('\nCreating DealProduct record...');
    const dealProduct = await DealProduct.create({
      dealId: testData.dealId,
      productId: testData.productId,
      variationId: testData.variationId,
      quantity: testData.quantity,
      unitPrice: testData.unitPrice,
      currency: testData.currency || 'INR',
      discountType: testData.discountType,
      discountValue: testData.discountValue,
      discountAmount,
      taxType: testData.taxType || 'tax-exclusive',
      taxPercentage: testData.taxPercentage || 0,
      taxAmount,
      subtotal,
      total,
      billingFrequency: testData.billingFrequency,
      billingStartDate: testData.billingStartDate,
      billingEndDate: testData.billingEndDate,
      notes: testData.notes,
    });
    
    console.log('\n✅ DealProduct created successfully!');
    console.log('DealProduct ID:', dealProduct.dealProductId);
    
    // Fetch it back with associations
    const createdDealProduct = await DealProduct.findByPk(dealProduct.dealProductId, {
      include: [
        {
          model: Product,
          as: 'product',
        }
      ],
    });
    
    console.log('\nCreated Deal Product:');
    console.log(JSON.stringify(createdDealProduct, null, 2));
    
    // Now test getDealProducts
    console.log('\n\n=== Testing getDealProducts ===\n');
    const dealProducts = await DealProduct.findAll({
      where: { dealId: 344 },
      include: [
        {
          model: Product,
          as: 'product',
        }
      ],
      order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
    });
    
    console.log('Found products for deal 344:', dealProducts.length);
    console.log(JSON.stringify(dealProducts, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAddProductToDeal();
