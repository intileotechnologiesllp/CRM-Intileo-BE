const LeadFilter = require('./models/leads/leadFiltersModel');
const sequelize = require('./config/db');

async function checkFilter() {
  try {
    const filterId = process.argv[2] || 101;
    const filter = await LeadFilter.findByPk(filterId);
    
    if (!filter) {
      console.log(`❌ Filter with ID ${filterId} not found`);
      process.exit(0);
    }
    
    console.log('✅ Filter found:');
    console.log('Filter ID:', filter.filterId);
    console.log('Filter Name:', filter.filterName);
    console.log('Filter Entity Type:', filter.filterEntityType);
    console.log('Visibility:', filter.visibility);
    
    // Parse the config (handle multiple levels of stringification)
    let config = filter.filterConfig;
    while (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (e) {
        break;
      }
    }
    
    console.log('\nParsed Filter Config:');
    console.log(JSON.stringify(config, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkFilter();
