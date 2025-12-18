# Backend API Documentation

## Base URL
`http://localhost:4000/api`

## Authentication
Currently, user identification is done via headers:
- `x-user-id`: User ID
- `x-user-email`: User email

## Endpoints

### Regulations

#### GET `/api/regulations`
Get all regulations with optional filters.

**Query Parameters:**
- `status` (optional): Filter by status (Draft, Pending Review, Needs Revision, Pending Approval, Pending Publish, Published)
- `category` (optional): Filter by category
- `userId` (optional): Filter by creator

**Response:**
```json
{
  "success": true,
  "data": [...]
}
```

#### GET `/api/regulations/:id`
Get a single regulation by ID.

#### POST `/api/regulations`
Create a new regulation.

**Body:**
```json
{
  "title": "Regulation Title",
  "category": "HR",
  "code": "REG-001",
  "description": "Description",
  "notes": "Notes",
  "deadline": "2024-12-31",
  "effectiveDate": "2025-01-01",
  "version": "v1.0",
  "createdBy": "user-id"
}
```

#### PUT `/api/regulations/:id`
Update a regulation.

#### DELETE `/api/regulations/:id`
Delete a regulation.

#### POST `/api/regulations/:id/submit`
Submit a regulation for review (changes status from Draft/Needs Revision to Pending Review).

#### POST `/api/regulations/:id/review`
Review a regulation (approve or reject).

**Body:**
```json
{
  "action": "approve" | "reject",
  "feedback": "Review feedback",
  "reviewedBy": "user-id"
}
```

#### POST `/api/regulations/:id/approve`
Approve a regulation (changes status from Pending Approval to Pending Publish).

**Body:**
```json
{
  "approvedBy": "user-id"
}
```

#### POST `/api/regulations/:id/publish`
Publish a regulation (changes status from Pending Publish to Published).

**Body:**
```json
{
  "publishedBy": "user-id"
}
```

### Users

#### GET `/api/users`
Get all users with optional filters.

**Query Parameters:**
- `role` (optional): Filter by role (employee, reviewer, approver, admin)
- `email` (optional): Filter by email

#### GET `/api/users/:id`
Get a single user by ID.

#### POST `/api/users`
Create a new user.

**Body:**
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "role": "employee",
  "department": "HR",
  "password": "password"
}
```

#### PUT `/api/users/:id`
Update a user.

#### DELETE `/api/users/:id`
Deactivate a user (soft delete).

#### GET `/api/users/:id/stats`
Get statistics for a specific user.

### Statistics

#### GET `/api/statistics/overview`
Get overall statistics including regulations, users, access logs, and deadlines.

#### GET `/api/statistics/regulations`
Get regulation statistics.

**Query Parameters:**
- `startDate` (optional): Start date for filtering
- `endDate` (optional): End date for filtering
- `category` (optional): Filter by category

#### GET `/api/statistics/access`
Get access log statistics.

**Query Parameters:**
- `startDate` (optional): Start date for filtering
- `endDate` (optional): End date for filtering
- `userId` (optional): Filter by user ID

#### GET `/api/statistics/deadlines`
Get deadline and SLA statistics.

#### GET `/api/statistics/sla/:regulationId`
Get SLA metrics for a specific regulation.

### Deadlines

#### GET `/api/deadlines/overdue`
Get all overdue regulations.

#### GET `/api/deadlines/upcoming`
Get upcoming deadlines.

**Query Parameters:**
- `days` (optional): Number of days to look ahead (default: 7)

#### POST `/api/deadlines/check`
Manually trigger a deadline check.

#### GET `/api/deadlines/reminders`
Get deadline reminders.

**Query Parameters:**
- `notified` (optional): Filter by notified status (true/false)
- `type` (optional): Filter by type (upcoming/overdue)

#### PUT `/api/deadlines/reminders/:id/notify`
Mark a reminder as notified.

## Workflow States

The regulation workflow follows these stages:

1. **Draft** - Initial creation
2. **Pending Review** - Submitted for review
3. **Needs Revision** - Rejected during review, needs changes
4. **Pending Approval** - Approved in review, awaiting final approval
5. **Pending Publish** - Approved, ready to publish
6. **Published** - Final published state

## Access Logging

All API requests are automatically logged to the `access_logs` collection in Firestore with:
- Method, path, URL
- Status code, response time
- User information (if available)
- IP address, user agent
- Timestamp

## Scheduled Jobs

The system includes scheduled jobs that run automatically:
- Daily deadline check at 9 AM
- Frequent deadline check every 6 hours

These jobs check for upcoming deadlines and overdue regulations, creating reminders in the `deadline_reminders` collection.

