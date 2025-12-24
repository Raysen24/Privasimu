#!/bin/bash

# API Testing Script
# Make sure the server is running on port 4000

BASE_URL="http://localhost:4000/api"

echo "========================================="
echo "Testing API Endpoints"
echo "========================================="
echo ""

# Test Health Check
echo "1. Testing Health Check..."
curl -s -X GET "$BASE_URL/../health" | jq '.' || echo "Failed"
echo ""

# Test Get All Regulations (should return empty array if no data)
echo "2. Testing GET /api/regulations..."
curl -s -X GET "$BASE_URL/regulations" | jq '.' || echo "Failed"
echo ""

# Test Create User
echo "3. Testing POST /api/users (Create User)..."
USER_RESPONSE=$(curl -s -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "role": "employee",
    "department": "IT"
  }')
echo "$USER_RESPONSE" | jq '.' || echo "$USER_RESPONSE"
USER_ID=$(echo "$USER_RESPONSE" | jq -r '.data.id // empty')
echo ""

# Test Get User
if [ ! -z "$USER_ID" ]; then
  echo "4. Testing GET /api/users/$USER_ID..."
  curl -s -X GET "$BASE_URL/users/$USER_ID" | jq '.' || echo "Failed"
  echo ""
fi

# Test Create Regulation
echo "5. Testing POST /api/regulations (Create Regulation)..."
REGULATION_RESPONSE=$(curl -s -X POST "$BASE_URL/regulations" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d '{
    "title": "Test Regulation",
    "category": "HR",
    "code": "TEST-001",
    "description": "This is a test regulation",
    "notes": "Test notes",
    "deadline": "2024-12-31",
    "effectiveDate": "2025-01-01",
    "version": "v1.0",
    "createdBy": "'"$USER_ID"'"
  }')
echo "$REGULATION_RESPONSE" | jq '.' || echo "$REGULATION_RESPONSE"
REGULATION_ID=$(echo "$REGULATION_RESPONSE" | jq -r '.data.id // empty')
echo ""

# Test Get Regulation
if [ ! -z "$REGULATION_ID" ]; then
  echo "6. Testing GET /api/regulations/$REGULATION_ID..."
  curl -s -X GET "$BASE_URL/regulations/$REGULATION_ID" | jq '.' || echo "Failed"
  echo ""

  # Test Submit Regulation
  echo "7. Testing POST /api/regulations/$REGULATION_ID/submit..."
  curl -s -X POST "$BASE_URL/regulations/$REGULATION_ID/submit" | jq '.' || echo "Failed"
  echo ""

  # Test Get Regulation After Submit
  echo "8. Testing GET /api/regulations/$REGULATION_ID (after submit)..."
  curl -s -X GET "$BASE_URL/regulations/$REGULATION_ID" | jq '.' || echo "Failed"
  echo ""
fi

# Test Statistics
echo "9. Testing GET /api/statistics/overview..."
curl -s -X GET "$BASE_URL/statistics/overview" | jq '.' || echo "Failed"
echo ""

# Test Deadlines
echo "10. Testing GET /api/deadlines/overdue..."
curl -s -X GET "$BASE_URL/deadlines/overdue" | jq '.' || echo "Failed"
echo ""

echo "11. Testing GET /api/deadlines/upcoming..."
curl -s -X GET "$BASE_URL/deadlines/upcoming?days=7" | jq '.' || echo "Failed"
echo ""

echo "========================================="
echo "Testing Complete!"
echo "========================================="

