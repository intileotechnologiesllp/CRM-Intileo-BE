// Script to create a test web form in your CRM
// Run this with: node create-test-form.js

const axios = require('axios');

const API_URL = 'http://localhost:4001';

// You'll need to get a valid auth token first
// Login to get token:
async function login() {
  try {
    const response = await axios.post(`${API_URL}/api/signin`, {
      email: 'your_admin_email@example.com',  // CHANGE THIS
      password: 'your_password'                // CHANGE THIS
    });
    
    return response.data.token;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

// Create a test form:
async function createTestForm(token) {
  try {
    const formData = {
      formName: 'Test Contact Form',
      formTitle: 'Get in Touch',
      formDescription: 'Fill out this form and we\'ll get back to you',
      primaryColor: '#4CAF50',
      buttonText: 'Submit',
      successMessage: 'Thank you! We\'ll contact you soon.',
      gdprCompliant: false,
      status: 'active',
      fields: [
        {
          fieldName: 'name',
          fieldLabel: 'Full Name',
          fieldType: 'text',
          isRequired: true,
          fieldOrder: 1,
          placeholder: 'Enter your name'
        },
        {
          fieldName: 'email',
          fieldLabel: 'Email Address',
          fieldType: 'email',
          isRequired: true,
          fieldOrder: 2,
          placeholder: 'your@email.com'
        },
        {
          fieldName: 'message',
          fieldLabel: 'Message',
          fieldType: 'textarea',
          isRequired: true,
          fieldOrder: 3,
          placeholder: 'Your message here...'
        }
      ]
    };

    const response = await axios.post(`${API_URL}/api/webforms`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('❌ Form creation failed:', error.response?.data || error.message);
    throw error;
  }
}

// Main execution:
async function main() {
  console.log('🚀 Creating test web form...\n');
  
  try {
    // Step 1: Login
    console.log('📝 Step 1: Logging in...');
    const token = await login();
    console.log('✅ Login successful!\n');

    // Step 2: Create form
    console.log('📝 Step 2: Creating form...');
    const result = await createTestForm(token);
    console.log('✅ Form created successfully!\n');

    // Step 3: Show results
    console.log('=' .repeat(60));
    console.log('✅ SUCCESS! Your test form is ready');
    console.log('=' .repeat(60));
    console.log('\n📋 Form Details:');
    console.log('   Form ID:', result.data?.formId);
    console.log('   Form Name:', result.data?.formName);
    console.log('   Unique Key:', result.data?.uniqueKey);
    console.log('\n🔗 Use this in your iframe:');
    console.log(`   http://localhost:4001/embed-form/${result.data?.uniqueKey}`);
    console.log('\n📝 HTML Code:');
    console.log(`   <iframe src="http://localhost:4001/embed-form/${result.data?.uniqueKey}" width="600" height="800"></iframe>`);
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Failed to create test form');
    console.error('Please check your credentials in the script and try again.');
  }
}

// Run the script
main();
