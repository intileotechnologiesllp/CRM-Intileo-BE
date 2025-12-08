const sequelize = require('./config/db');

async function checkData() {
  try {
    // Check products
    const [products] = await sequelize.query('SELECT productId, name, code FROM products LIMIT 5');
    console.log('Products in database:');
    console.table(products);
    
    // Check deals
    const [deals] = await sequelize.query('SELECT dealId, title FROM Deals LIMIT 5');
    console.log('\nDeals in database:');
    console.table(deals);
    
    // Check deal_products
    const [dealProducts] = await sequelize.query('SELECT * FROM deal_products');
    console.log('\nDeal Products:');
    console.table(dealProducts);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkData();
