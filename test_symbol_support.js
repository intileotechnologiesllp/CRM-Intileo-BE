// Test Object.getOwnPropertySymbols() functionality
const { Op } = require('sequelize');

console.log('Testing Object.getOwnPropertySymbols()...\n');

// Create a test object with Symbol properties
const testObj = {
  [Op.and]: [{ name: 'test' }]
};

console.log('Test object:', testObj);
console.log('Object.keys():', Object.keys(testObj));
console.log('Object.getOwnPropertySymbols():', Object.getOwnPropertySymbols(testObj));
console.log('Symbol keys length:', Object.getOwnPropertySymbols(testObj).length);
console.log('Regular keys length:', Object.keys(testObj).length);

const hasConditions = Object.getOwnPropertySymbols(testObj).length > 0 || Object.keys(testObj).length > 0;
console.log('\nhasConditions:', hasConditions);

console.log('\n✅ Object.getOwnPropertySymbols() works correctly!');
