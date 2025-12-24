/**
 * API Testing Script
 * Run with: node test-api.js
 * 
 * Note: Requires Node.js 18+ for fetch API, or install node-fetch:
 * npm install node-fetch@2
 */

const http = require('http');

const BASE_URL = "http://localhost:4000/api";

// Helper function to make requests
function request(method, endpoint, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const options = {
      hostname: url.hostname,
      port: url.port || 4000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ status: 0, error: error.message });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test functions
async function testHealthCheck() {
  console.log("\n1. Testing Health Check...");
  return new Promise((resolve) => {
    http.get("http://localhost:4000/health", (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          console.log("Status:", res.statusCode);
          console.log("Response:", JSON.stringify(data, null, 2));
          resolve(res.statusCode === 200);
        } catch (e) {
          console.log("Status:", res.statusCode);
          console.log("Response:", body);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.log("Error:", err.message);
      resolve(false);
    });
  });
}

async function testGetRegulations() {
  console.log("\n2. Testing GET /api/regulations...");
  const result = await request("GET", "/regulations");
  console.log("Status:", result.status);
  console.log("Response:", JSON.stringify(result.data, null, 2));
  return result.status === 200;
}

async function testCreateUser() {
  console.log("\n3. Testing POST /api/users...");
  const userData = {
    email: "test@example.com",
    name: "Test User",
    role: "employee",
    department: "IT",
  };
  const result = await request("POST", "/users", userData);
  console.log("Status:", result.status);
  console.log("Response:", JSON.stringify(result.data, null, 2));
  return result.data?.success ? result.data.data.id : null;
}

async function testGetUser(userId) {
  if (!userId) return false;
  console.log(`\n4. Testing GET /api/users/${userId}...`);
  const result = await request("GET", `/users/${userId}`);
  console.log("Status:", result.status);
  console.log("Response:", JSON.stringify(result.data, null, 2));
  return result.status === 200;
}

async function testCreateRegulation(userId) {
  console.log("\n5. Testing POST /api/regulations...");
  const regulationData = {
    title: "Test Regulation",
    category: "HR",
    code: "TEST-001",
    description: "This is a test regulation",
    notes: "Test notes",
    deadline: "2024-12-31",
    effectiveDate: "2025-01-01",
    version: "v1.0",
    createdBy: userId,
  };
  const result = await request("POST", "/regulations", regulationData, {
    "x-user-id": userId,
  });
  console.log("Status:", result.status);
  console.log("Response:", JSON.stringify(result.data, null, 2));
  return result.data?.success ? result.data.data.id : null;
}

async function testGetRegulation(regulationId) {
  if (!regulationId) return false;
  console.log(`\n6. Testing GET /api/regulations/${regulationId}...`);
  const result = await request("GET", `/regulations/${regulationId}`);
  console.log("Status:", result.status);
  console.log("Response:", JSON.stringify(result.data, null, 2));
  return result.status === 200;
}

async function testSubmitRegulation(regulationId) {
  if (!regulationId) return false;
  console.log(`\n7. Testing POST /api/regulations/${regulationId}/submit...`);
  const result = await request("POST", `/regulations/${regulationId}/submit`);
  console.log("Status:", result.status);
  console.log("Response:", JSON.stringify(result.data, null, 2));
  return result.status === 200;
}

async function testStatistics() {
  console.log("\n8. Testing GET /api/statistics/overview...");
  const result = await request("GET", "/statistics/overview");
  console.log("Status:", result.status);
  console.log("Response:", JSON.stringify(result.data, null, 2));
  return result.status === 200;
}

async function testDeadlines() {
  console.log("\n9. Testing GET /api/deadlines/overdue...");
  const result = await request("GET", "/deadlines/overdue");
  console.log("Status:", result.status);
  console.log("Response:", JSON.stringify(result.data, null, 2));

  console.log("\n10. Testing GET /api/deadlines/upcoming...");
  const result2 = await request("GET", "/deadlines/upcoming?days=7");
  console.log("Status:", result2.status);
  console.log("Response:", JSON.stringify(result2.data, null, 2));
  return result.status === 200;
}

// Main test runner
async function runTests() {
  console.log("=========================================");
  console.log("API Testing Script");
  console.log("=========================================");
  console.log("Make sure the server is running on port 4000");
  console.log("Starting tests...");

  try {
    // Basic tests
    await testHealthCheck();
    await testGetRegulations();

    // User tests
    const userId = await testCreateUser();
    if (userId) {
      await testGetUser(userId);
    }

    // Regulation tests
    const regulationId = await testCreateRegulation(userId);
    if (regulationId) {
      await testGetRegulation(regulationId);
      await testSubmitRegulation(regulationId);
      await testGetRegulation(regulationId); // Check status after submit
    }

    // Statistics and deadlines
    await testStatistics();
    await testDeadlines();

    console.log("\n=========================================");
    console.log("Testing Complete!");
    console.log("=========================================");
  } catch (error) {
    console.error("\nError during testing:", error);
  }
}

// Run tests
runTests();

