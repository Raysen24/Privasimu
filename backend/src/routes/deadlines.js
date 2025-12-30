const express = require("express");
const router = express.Router();
const deadlineReminderService = require("../services/deadlineReminder");

// GET overdue regulations
router.get("/overdue", async (req, res) => {
  try {
    const overdue = await deadlineReminderService.getOverdueRegulations();
    res.json({ success: true, data: overdue });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET upcoming deadlines
router.get("/upcoming", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const upcoming = await deadlineReminderService.getUpcomingDeadlines(days);
    res.json({ success: true, data: upcoming });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST check deadlines (manual trigger)
router.post("/check", async (req, res) => {
  try {
    const result = await deadlineReminderService.checkUpcomingDeadlines();
    res.json({
      success: true,
      message: "Deadline check completed",
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET check deadlines (for Vercel Cron - Cron uses GET requests)
router.get("/check", async (req, res) => {
  try {
    const result = await deadlineReminderService.checkUpcomingDeadlines();
    res.json({
      success: true,
      message: "Deadline check completed",
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET reminders
router.get("/reminders", async (req, res) => {
  try {
    const { db } = require("../firebase");
    const { notified, type } = req.query;

    let query = db.collection("deadline_reminders").orderBy("createdAt", "desc");

    if (notified !== undefined) {
      query = query.where("notified", "==", notified === "true");
    }
    if (type) {
      query = query.where("type", "==", type);
    }

    const snapshot = await query.limit(100).get();
    const reminders = [];

    snapshot.forEach((doc) => {
      reminders.push({ id: doc.id, ...doc.data() });
    });

    res.json({ success: true, data: reminders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT mark reminder as notified
router.put("/reminders/:id/notify", async (req, res) => {
  try {
    const { id } = req.params;
    const { db } = require("../firebase");
    const docRef = db.collection("deadline_reminders").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "Reminder not found" });
    }

    await docRef.update({
      notified: true,
      notifiedAt: new Date(),
    });

    res.json({ success: true, message: "Reminder marked as notified" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

