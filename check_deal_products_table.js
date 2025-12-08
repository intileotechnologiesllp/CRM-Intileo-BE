const sequelize = require('./config/db');

async function checkTable() {
  try {
    // Check if table exists
    const [tables] = await sequelize.query('SHOW TABLES LIKE "deal_products"');
    console.log('Table exists:', tables.length > 0 ? 'YES' : 'NO');
    
    if (tables.length > 0) {
      // Show table structure
      const [structure] = await sequelize.query('DESCRIBE deal_products');
      console.log('\nTable structure:');
      console.table(structure);
      
      // Count records
      const [count] = await sequelize.query('SELECT COUNT(*) as total FROM deal_products');
      console.log('\nTotal records:', count[0].total);
      
      // Show sample data
      const [data] = await sequelize.query('SELECT * FROM deal_products LIMIT 5');
      console.log('\nSample data:');
      console.log(JSON.stringify(data, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTable();
