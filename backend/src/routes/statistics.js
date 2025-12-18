const express = require("express");
const router = express.Router();
const { db } = require("../firebase");
const deadlineReminderService = require("../services/deadlineReminder");

// Cache for statistics
const statsCache = {
  data: null,
  timestamp: 0,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
};

// Get statistics for dashboard with caching
router.get("/overview", async (req, res) => {
  try {
    const now = Date.now();
    
    // Return cached data if still valid
    if (statsCache.data && (now - statsCache.timestamp < statsCache.CACHE_TTL)) {
      return res.json({ 
        success: true, 
        data: statsCache.data,
        fromCache: true,
        cacheExpiresIn: Math.ceil((statsCache.timestamp + statsCache.CACHE_TTL - now) / 1000) + 's'
      });
    }

    // Initialize default values
    let regulations = [];
    let totalUsers = 0;
    let logs = [];

    try {
      // Get only necessary fields for statistics
      const regulationsSnapshot = await db.collection("regulations")
        .select('status', 'category', 'deadline', 'createdAt')
        .get();
        
      regulationsSnapshot.forEach((doc) => {
        if (doc.exists) {
          regulations.push(doc.data());
        }
      });
    } catch (error) {
      console.error('Error fetching regulations for statistics:', error);
      // Continue with empty regulations array
    }

    try {
      // Get user count - using get() and counting client-side for compatibility
      const usersSnapshot = await db.collection('users').get();
      totalUsers = usersSnapshot.size;
    } catch (error) {
      console.error('Error fetching user count:', error);
      // Continue with 0 users
    }

    try {
      // Get recent access logs (limited to last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const logsSnapshot = await db.collection("access_logs")
        .where('timestamp', '>=', oneDayAgo)
        .orderBy("timestamp", "desc")
        .limit(50) // Only get most recent 50 logs
        .get();

      logs = logsSnapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error('Error fetching access logs:', error);
      // Continue with empty logs array
    }

    // Calculate regulation statistics efficiently
    const regulationStats = {
      total: regulations.length,
      byStatus: {},
      byCategory: {},
    };

    // Single pass through regulations to calculate all stats
    regulations.forEach((r) => {
      // Status counts
      const status = r.status || 'Draft';
      regulationStats.byStatus[status] = (regulationStats.byStatus[status] || 0) + 1;
      
      // Category counts
      const category = r.category || "Uncategorized";
      regulationStats.byCategory[category] = (regulationStats.byCategory[category] || 0) + 1;
    });
    
    // Normalize status counts to combine similar statuses
    const normalizedStatusCounts = {
      'Draft': regulationStats.byStatus['Draft'] || 0,
      'Pending Review': regulationStats.byStatus['Pending Review'] || 0,
      'Needs Revision': regulationStats.byStatus['Needs Revision'] || 0,
      'Pending Publish': regulationStats.byStatus['Pending Publish'] || 0,
      'Published': regulationStats.byStatus['Published'] || 0
    };
    
    regulationStats.byStatus = normalizedStatusCounts;

    // Calculate monthly activity (drafts created per month)
    const monthlyActivityMap = {};
    regulations.forEach((r) => {
      if (!r.createdAt) return;
      const createdAt = r.createdAt.toDate
        ? r.createdAt.toDate()
        : new Date(r.createdAt);
      if (Number.isNaN(createdAt.getTime())) return;
      const monthKey = `${createdAt.getFullYear()}-${String(
        createdAt.getMonth() + 1
      ).padStart(2, "0")}`;
      monthlyActivityMap[monthKey] = (monthlyActivityMap[monthKey] || 0) + 1;
    });
    const monthlyActivityKeys = Object.keys(monthlyActivityMap).sort();
    const monthlyActivity = monthlyActivityKeys
      .slice(Math.max(monthlyActivityKeys.length - 6, 0))
      .map((month) => ({
        month,
        drafts: monthlyActivityMap[month],
      }));

    // Calculate overdue and upcoming deadlines
    const overdue = await deadlineReminderService.getOverdueRegulations();
    const upcoming = await deadlineReminderService.getUpcomingDeadlines(7);

    // Fetch users for user statistics
    let users = [];
    try {
      const usersSnapshot = await db.collection('users').get();
      users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      // Continue with empty users array
    }

    // Calculate user statistics
    const userStats = {
      total: users.length,
      byRole: {},
    };

    users.forEach((u) => {
      const role = u.role || "employee";
      userStats.byRole[role] = (userStats.byRole[role] || 0) + 1;
    });

    // Calculate access log statistics
    const accessStats = {
      totalRequests: logs.length,
      byMethod: {},
      byStatus: {},
      averageResponseTime: 0,
      uniqueUsers: new Set(),
      requestsByDay: {},
    };

    let totalResponseTime = 0;
    logs.forEach((log) => {
      // Count by method
      accessStats.byMethod[log.method] =
        (accessStats.byMethod[log.method] || 0) + 1;

      // Count by status code
      const statusGroup = Math.floor(log.statusCode / 100) * 100;
      accessStats.byStatus[statusGroup] =
        (accessStats.byStatus[statusGroup] || 0) + 1;

      // Sum response times
      totalResponseTime += log.duration || 0;

      // Track unique users
      if (log.userId) {
        accessStats.uniqueUsers.add(log.userId);
      }

      // Count requests by day
      if (log.timestamp) {
        const date = log.timestamp.toDate
          ? log.timestamp.toDate()
          : new Date(log.timestamp);
        const dayKey = date.toISOString().split("T")[0];
        accessStats.requestsByDay[dayKey] =
          (accessStats.requestsByDay[dayKey] || 0) + 1;
      }
    });

    accessStats.averageResponseTime =
      logs.length > 0 ? Math.round(totalResponseTime / logs.length) : 0;
    accessStats.uniqueUsers = accessStats.uniqueUsers.size;

    res.json({
      success: true,
      data: {
        regulations: regulationStats,
        users: userStats,
        access: accessStats,
        deadlines: {
          overdue: overdue.length,
          upcoming: upcoming.length,
        },
        charts: {
          monthlyActivity,
        },
        timestamp: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET regulation statistics
router.get("/regulations", async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;

    let query = db.collection("regulations");

    if (startDate || endDate) {
      // Note: Firestore doesn't support range queries on createdAt directly
      // You might need to adjust this based on your needs
    }

    if (category) {
      query = query.where("category", "==", category);
    }

    const snapshot = await query.get();
    const regulations = [];

    snapshot.forEach((doc) => {
      regulations.push({ id: doc.id, ...doc.data() });
    });

    // Filter by date range if provided
    let filteredRegulations = regulations;
    if (startDate || endDate) {
      filteredRegulations = regulations.filter((r) => {
        if (!r.createdAt) return false;
        const created = r.createdAt.toDate
          ? r.createdAt.toDate()
          : new Date(r.createdAt);
        if (startDate && created < new Date(startDate)) return false;
        if (endDate && created > new Date(endDate)) return false;
        return true;
      });
    }

    // Calculate statistics
    const stats = {
      total: filteredRegulations.length,
      byStatus: {},
      byCategory: {},
      averageProcessingTime: 0,
      completionRate: 0,
    };

    let totalProcessingTime = 0;
    let completedCount = 0;

    filteredRegulations.forEach((r) => {
      // Count by status
      stats.byStatus[r.status] = (stats.byStatus[r.status] || 0) + 1;

      // Count by category
      const cat = r.category || "Uncategorized";
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

      // Calculate processing time for published regulations
      if (r.status === "Published" && r.createdAt && r.publishedAt) {
        const created = r.createdAt.toDate
          ? r.createdAt.toDate()
          : new Date(r.createdAt);
        const published = r.publishedAt.toDate
          ? r.publishedAt.toDate()
          : new Date(r.publishedAt);
        const processingTime = published.getTime() - created.getTime();
        totalProcessingTime += processingTime;
        completedCount++;
      }
    });

    stats.averageProcessingTime =
      completedCount > 0
        ? Math.ceil(totalProcessingTime / completedCount / (1000 * 60 * 60 * 24))
        : 0; // in days
    stats.completionRate =
      filteredRegulations.length > 0
        ? (completedCount / filteredRegulations.length) * 100
        : 0;

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET access log statistics
router.get("/access", async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    let query = db.collection("access_logs").orderBy("timestamp", "desc");

    if (userId) {
      query = query.where("userId", "==", userId);
    }

    // Limit to last 1000 logs for performance
    const snapshot = await query.limit(1000).get();
    const logs = [];

    snapshot.forEach((doc) => {
      logs.push(doc.data());
    });

    // Filter by date range if provided
    let filteredLogs = logs;
    if (startDate || endDate) {
      filteredLogs = logs.filter((log) => {
        if (!log.timestamp) return false;
        const timestamp = log.timestamp.toDate
          ? log.timestamp.toDate()
          : new Date(log.timestamp);
        if (startDate && timestamp < new Date(startDate)) return false;
        if (endDate && timestamp > new Date(endDate)) return false;
        return true;
      });
    }

    // Calculate statistics
    const stats = {
      totalRequests: filteredLogs.length,
      byMethod: {},
      byPath: {},
      byStatus: {},
      averageResponseTime: 0,
      uniqueUsers: new Set(),
      requestsByHour: {},
      topEndpoints: [],
    };

    let totalResponseTime = 0;

    filteredLogs.forEach((log) => {
      // Count by method
      stats.byMethod[log.method] = (stats.byMethod[log.method] || 0) + 1;

      // Count by path
      const path = log.path || log.url || "unknown";
      stats.byPath[path] = (stats.byPath[path] || 0) + 1;

      // Count by status code
      const statusGroup = Math.floor(log.statusCode / 100) * 100;
      stats.byStatus[statusGroup] = (stats.byStatus[statusGroup] || 0) + 1;

      // Sum response times
      totalResponseTime += log.duration || 0;

      // Track unique users
      if (log.userId) {
        stats.uniqueUsers.add(log.userId);
      }

      // Count requests by hour
      if (log.timestamp) {
        const timestamp = log.timestamp.toDate
          ? log.timestamp.toDate()
          : new Date(log.timestamp);
        const hourKey = `${timestamp.getFullYear()}-${String(
          timestamp.getMonth() + 1
        ).padStart(2, "0")}-${String(timestamp.getDate()).padStart(
          2,
          "0"
        )} ${String(timestamp.getHours()).padStart(2, "0")}:00`;
        stats.requestsByHour[hourKey] = (stats.requestsByHour[hourKey] || 0) + 1;
      }
    });

    stats.averageResponseTime =
      filteredLogs.length > 0
        ? Math.round(totalResponseTime / filteredLogs.length)
        : 0;
    stats.uniqueUsers = stats.uniqueUsers.size;

    // Get top endpoints
    stats.topEndpoints = Object.entries(stats.byPath)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET deadline and SLA statistics
router.get("/deadlines", async (req, res) => {
  try {
    const overdue = await deadlineReminderService.getOverdueRegulations();
    const upcoming = await deadlineReminderService.getUpcomingDeadlines(7);
    const upcoming30 = await deadlineReminderService.getUpcomingDeadlines(30);

    // Get all regulations for SLA calculation
    const snapshot = await db.collection("regulations").get();
    const regulations = [];

    snapshot.forEach((doc) => {
      regulations.push({ id: doc.id, ...doc.data() });
    });

    // Calculate average SLA metrics
    const slaMetrics = {
      averageDraftTime: 0,
      averageReviewTime: 0,
      averageApprovalTime: 0,
      averagePublishTime: 0,
      averageTotalTime: 0,
      regulationsAnalyzed: 0,
    };

    let totalDraftTime = 0;
    let totalReviewTime = 0;
    let totalApprovalTime = 0;
    let totalPublishTime = 0;
    let totalTime = 0;
    let count = 0;

    for (const regulation of regulations) {
      if (regulation.status === "Published" && regulation.publishedAt) {
        try {
          const sla = await deadlineReminderService.calculateSLA(regulation.id);
          if (sla.stages.draft) {
            totalDraftTime += sla.stages.draft.durationDays;
          }
          if (sla.stages.review) {
            totalReviewTime += sla.stages.review.durationDays;
          }
          if (sla.stages.approval) {
            totalApprovalTime += sla.stages.approval.durationDays;
          }
          if (sla.stages.publish) {
            totalPublishTime += sla.stages.publish.durationDays;
          }
          totalTime += sla.totalTimeDays;
          count++;
        } catch (err) {
          // Skip if error calculating SLA
        }
      }
    }

    if (count > 0) {
      slaMetrics.averageDraftTime = Math.round(totalDraftTime / count);
      slaMetrics.averageReviewTime = Math.round(totalReviewTime / count);
      slaMetrics.averageApprovalTime = Math.round(totalApprovalTime / count);
      slaMetrics.averagePublishTime = Math.round(totalPublishTime / count);
      slaMetrics.averageTotalTime = Math.round(totalTime / count);
      slaMetrics.regulationsAnalyzed = count;
    }

    res.json({
      success: true,
      data: {
        overdue: {
          count: overdue.length,
          regulations: overdue.map((r) => ({
            id: r.id,
            title: r.title,
            daysOverdue: r.daysOverdue,
            status: r.status,
          })),
        },
        upcoming: {
          next7Days: {
            count: upcoming.length,
            regulations: upcoming.map((r) => ({
              id: r.id,
              title: r.title,
              daysUntilDeadline: r.daysUntilDeadline,
              status: r.status,
            })),
          },
          next30Days: {
            count: upcoming30.length,
          },
        },
        sla: slaMetrics,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET SLA for a specific regulation
router.get("/sla/:regulationId", async (req, res) => {
  try {
    const { regulationId } = req.params;
    const sla = await deadlineReminderService.calculateSLA(regulationId);
    res.json({ success: true, data: sla });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

