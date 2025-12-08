const axios = require('axios');

async function testFilter102() {
  try {
    console.log('🧪 Testing Filter 102 via API...\n');
    
    // Make sure to use the correct URL and authentication
    const response = await axios.get('http://localhost:4001/api/deals/get', {
      params: {
        filterId: 102,
        page: 1,
        limit: 20
      },
      headers: {
        // Add your authentication token here if needed
        // 'Authorization': 'Bearer YOUR_TOKEN'
      }
    });

    console.log('✅ API Response:');
    console.log('Total Deals:', response.data.totalDeals);
    console.log('Deals returned:', response.data.deals.length);
    console.log('\nDeals:');
    response.data.deals.forEach((deal, index) => {
      console.log(`${index + 1}. Deal ${deal.dealId}: "${deal.title}"`);
      console.log(`   Contact: ${deal.contactPerson}`);
      console.log(`   Organization: ${deal.organization}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testFilter102();
