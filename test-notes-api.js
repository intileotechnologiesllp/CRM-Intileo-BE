// Test file for Person and Organization Notes APIs
// Run this with: node test-notes-api.js

const axios = require("axios");

// Configure your base URL and auth token
const BASE_URL = "http://localhost:3000/api/lead-contacts";
const AUTH_TOKEN = "your-jwt-token-here";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    "Content-Type": "application/json",
  },
});

// Test data
const testPersonId = 1;
const testOrgId = 1;
const testNote = "This is a test note for API testing";
const updatedNote = "This is an updated test note";

let createdPersonNoteId;
let createdOrgNoteId;

async function runTests() {
  console.log("🚀 Starting Notes API Tests...\n");

  try {
    // Test 1: Create Person Note
    console.log("1️⃣ Testing Create Person Note...");
    const personNoteResponse = await api.post(
      `/create-person-note/${testPersonId}`,
      {
        content: testNote,
      }
    );
    console.log("✅ Person note created:", personNoteResponse.data);
    createdPersonNoteId = personNoteResponse.data.note.noteId;
    console.log("");

    // Test 2: Create Organization Note
    console.log("2️⃣ Testing Create Organization Note...");
    const orgNoteResponse = await api.post(
      `/create-organization-note/${testOrgId}`,
      {
        content: testNote,
      }
    );
    console.log("✅ Organization note created:", orgNoteResponse.data);
    createdOrgNoteId = orgNoteResponse.data.note.noteId;
    console.log("");

    // Test 3: Get Person Notes
    console.log("3️⃣ Testing Get Person Notes...");
    const personNotesResponse = await api.get(
      `/get-person-notes/${testPersonId}`
    );
    console.log("✅ Person notes fetched:", personNotesResponse.data);
    console.log("");

    // Test 4: Get Organization Notes
    console.log("4️⃣ Testing Get Organization Notes...");
    const orgNotesResponse = await api.get(
      `/get-organization-notes/${testOrgId}`
    );
    console.log("✅ Organization notes fetched:", orgNotesResponse.data);
    console.log("");

    // Test 5: Update Person Note
    console.log("5️⃣ Testing Update Person Note...");
    const updatePersonNoteResponse = await api.put(
      `/update-person-note/${testPersonId}/${createdPersonNoteId}`,
      {
        content: updatedNote,
      }
    );
    console.log("✅ Person note updated:", updatePersonNoteResponse.data);
    console.log("");

    // Test 6: Update Organization Note
    console.log("6️⃣ Testing Update Organization Note...");
    const updateOrgNoteResponse = await api.put(
      `/update-organization-note/${testOrgId}/${createdOrgNoteId}`,
      {
        content: updatedNote,
      }
    );
    console.log("✅ Organization note updated:", updateOrgNoteResponse.data);
    console.log("");

    // Test 7: Get Notes Again (to verify updates)
    console.log("7️⃣ Testing Get Updated Notes...");
    const updatedPersonNotesResponse = await api.get(
      `/get-person-notes/${testPersonId}`
    );
    console.log(
      "✅ Updated person notes:",
      updatedPersonNotesResponse.data.notes[0].content
    );
    console.log("");

    // Test 8: Delete Person Note
    console.log("8️⃣ Testing Delete Person Note...");
    const deletePersonNoteResponse = await api.delete(
      `/delete-person-note/${testPersonId}/${createdPersonNoteId}`
    );
    console.log("✅ Person note deleted:", deletePersonNoteResponse.data);
    console.log("");

    // Test 9: Delete Organization Note
    console.log("9️⃣ Testing Delete Organization Note...");
    const deleteOrgNoteResponse = await api.delete(
      `/delete-organization-note/${testOrgId}/${createdOrgNoteId}`
    );
    console.log("✅ Organization note deleted:", deleteOrgNoteResponse.data);
    console.log("");

    console.log("🎉 All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

// Error handling tests
async function runErrorTests() {
  console.log("\n🧪 Testing Error Scenarios...\n");

  try {
    // Test invalid person ID
    console.log("1️⃣ Testing Invalid Person ID...");
    try {
      await api.post("/create-person-note/99999", { content: testNote });
    } catch (error) {
      console.log("✅ Expected error for invalid person:", error.response.data);
    }

    // Test empty content
    console.log("2️⃣ Testing Empty Content...");
    try {
      await api.post(`/create-person-note/${testPersonId}`, { content: "" });
    } catch (error) {
      console.log("✅ Expected error for empty content:", error.response.data);
    }

    // Test invalid note ID for update
    console.log("3️⃣ Testing Invalid Note ID...");
    try {
      await api.put(`/update-person-note/${testPersonId}/99999`, {
        content: updatedNote,
      });
    } catch (error) {
      console.log(
        "✅ Expected error for invalid note ID:",
        error.response.data
      );
    }

    console.log("\n🎉 Error tests completed successfully!");
  } catch (error) {
    console.error(
      "❌ Error test failed:",
      error.response?.data || error.message
    );
  }
}

// Pagination test
async function testPagination() {
  console.log("\n📄 Testing Pagination...\n");

  try {
    // Create multiple notes for pagination test
    console.log("Creating multiple notes for pagination test...");
    for (let i = 1; i <= 25; i++) {
      await api.post(`/create-person-note/${testPersonId}`, {
        content: `Test note ${i} for pagination`,
      });
    }

    // Test pagination
    console.log("Testing pagination...");
    const page1 = await api.get(
      `/get-person-notes/${testPersonId}?page=1&limit=10`
    );
    console.log(
      "✅ Page 1:",
      `Total: ${page1.data.pagination.total}, Page: ${page1.data.pagination.page}, Items: ${page1.data.notes.length}`
    );

    const page2 = await api.get(
      `/get-person-notes/${testPersonId}?page=2&limit=10`
    );
    console.log(
      "✅ Page 2:",
      `Total: ${page2.data.pagination.total}, Page: ${page2.data.pagination.page}, Items: ${page2.data.notes.length}`
    );
  } catch (error) {
    console.error(
      "❌ Pagination test failed:",
      error.response?.data || error.message
    );
  }
}

// Main execution
async function main() {
  console.log("📝 Notes API Test Suite");
  console.log("======================\n");
  console.log(`🔧 Configuration:`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Test Person ID: ${testPersonId}`);
  console.log(`   Test Organization ID: ${testOrgId}`);
  console.log(`   Auth Token: ${AUTH_TOKEN.substring(0, 20)}...`);
  console.log("");

  // Run all tests
  await runTests();
  await runErrorTests();
  await testPagination();

  console.log("\n✨ Test suite completed!");
}

// Uncomment to run the tests
// main();

module.exports = {
  runTests,
  runErrorTests,
  testPagination,
  main,
};
