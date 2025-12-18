const { db } = require("../firebase");

/**
 * Service for deadline reminders and SLA monitoring
 */
class DeadlineReminderService {
  /**
   * Check for regulations approaching deadlines
   */
  async checkUpcomingDeadlines() {
    try {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Get all regulations that are not published and have deadlines
      const snapshot = await db
        .collection("regulations")
        .where("status", "!=", "Published")
        .get();

      const reminders = [];
      const overdue = [];

      snapshot.forEach((doc) => {
        const regulation = { id: doc.id, ...doc.data() };
        
        if (!regulation.deadline) return;

        const deadline = regulation.deadline.toDate
          ? regulation.deadline.toDate()
          : new Date(regulation.deadline);
        
        const daysUntilDeadline = Math.ceil(
          (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if overdue
        if (deadline < now) {
          overdue.push({
            regulationId: doc.id,
            regulationTitle: regulation.title,
            deadline: deadline,
            daysOverdue: Math.abs(daysUntilDeadline),
            status: regulation.status,
            createdBy: regulation.createdBy,
          });
        }
        // Check if due within 3 days
        else if (deadline <= threeDaysFromNow && deadline > now) {
          reminders.push({
            regulationId: doc.id,
            regulationTitle: regulation.title,
            deadline: deadline,
            daysUntilDeadline: daysUntilDeadline,
            status: regulation.status,
            createdBy: regulation.createdBy,
            priority: deadline <= oneDayFromNow ? "high" : "medium",
          });
        }
      });

      // Store reminders in database
      if (reminders.length > 0 || overdue.length > 0) {
        await this.storeReminders(reminders, overdue);
      }

      return { reminders, overdue };
    } catch (error) {
      console.error("Error checking deadlines:", error);
      throw error;
    }
  }

  /**
   * Store reminders in database
   */
  async storeReminders(reminders, overdue) {
    try {
      const batch = db.batch();

      // Store upcoming reminders
      reminders.forEach((reminder) => {
        const reminderRef = db.collection("deadline_reminders").doc();
        batch.set(reminderRef, {
          ...reminder,
          type: "upcoming",
          createdAt: new Date(),
          notified: false,
        });
      });

      // Store overdue items
      overdue.forEach((item) => {
        const reminderRef = db.collection("deadline_reminders").doc();
        batch.set(reminderRef, {
          ...item,
          type: "overdue",
          createdAt: new Date(),
          notified: false,
        });
      });

      await batch.commit();
    } catch (error) {
      console.error("Error storing reminders:", error);
      throw error;
    }
  }

  /**
   * Calculate SLA metrics for a regulation
   */
  async calculateSLA(regulationId) {
    try {
      const doc = await db.collection("regulations").doc(regulationId).get();
      
      if (!doc.exists) {
        throw new Error("Regulation not found");
      }

      const regulation = doc.data();
      const now = new Date();

      // Calculate time spent in each stage
      const sla = {
        regulationId: doc.id,
        regulationTitle: regulation.title,
        currentStatus: regulation.status,
        stages: {},
        totalTime: 0,
        deadline: regulation.deadline?.toDate() || null,
        isOverdue: false,
        daysUntilDeadline: null,
      };

      // Calculate time in draft stage
      if (regulation.createdAt) {
        const draftStart = regulation.createdAt.toDate();
        const draftEnd = regulation.submittedAt
          ? regulation.submittedAt.toDate()
          : now;
        const draftTime = draftEnd.getTime() - draftStart.getTime();
        sla.stages.draft = {
          duration: draftTime,
          durationDays: Math.ceil(draftTime / (1000 * 60 * 60 * 24)),
          startTime: draftStart,
          endTime: regulation.submittedAt ? regulation.submittedAt.toDate() : null,
        };
        sla.totalTime += draftTime;
      }

      // Calculate time in review stage
      if (regulation.submittedAt) {
        const reviewStart = regulation.submittedAt.toDate();
        const reviewEnd = regulation.reviewedAt
          ? regulation.reviewedAt.toDate()
          : now;
        const reviewTime = reviewEnd.getTime() - reviewStart.getTime();
        sla.stages.review = {
          duration: reviewTime,
          durationDays: Math.ceil(reviewTime / (1000 * 60 * 60 * 24)),
          startTime: reviewStart,
          endTime: regulation.reviewedAt ? regulation.reviewedAt.toDate() : null,
        };
        sla.totalTime += reviewTime;
      }

      // Calculate time in approval stage
      if (regulation.reviewedAt && regulation.status !== "Needs Revision") {
        const approvalStart = regulation.reviewedAt.toDate();
        const approvalEnd = regulation.approvedAt
          ? regulation.approvedAt.toDate()
          : now;
        const approvalTime = approvalEnd.getTime() - approvalStart.getTime();
        sla.stages.approval = {
          duration: approvalTime,
          durationDays: Math.ceil(approvalTime / (1000 * 60 * 60 * 24)),
          startTime: approvalStart,
          endTime: regulation.approvedAt ? regulation.approvedAt.toDate() : null,
        };
        sla.totalTime += approvalTime;
      }

      // Calculate time in publish stage
      if (regulation.approvedAt) {
        const publishStart = regulation.approvedAt.toDate();
        const publishEnd = regulation.publishedAt
          ? regulation.publishedAt.toDate()
          : now;
        const publishTime = publishEnd.getTime() - publishStart.getTime();
        sla.stages.publish = {
          duration: publishTime,
          durationDays: Math.ceil(publishTime / (1000 * 60 * 60 * 24)),
          startTime: publishStart,
          endTime: regulation.publishedAt ? regulation.publishedAt.toDate() : null,
        };
        sla.totalTime += approvalTime;
      }

      // Check deadline status
      if (regulation.deadline) {
        const deadline = regulation.deadline.toDate();
        sla.daysUntilDeadline = Math.ceil(
          (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        sla.isOverdue = deadline < now && regulation.status !== "Published";
      }

      sla.totalTimeDays = Math.ceil(sla.totalTime / (1000 * 60 * 60 * 24));

      return sla;
    } catch (error) {
      console.error("Error calculating SLA:", error);
      throw error;
    }
  }

  /**
   * Get all overdue regulations
   */
  async getOverdueRegulations() {
    try {
      const now = new Date();
      const snapshot = await db
        .collection("regulations")
        .where("status", "!=", "Published")
        .get();

      const overdue = [];

      snapshot.forEach((doc) => {
        const regulation = doc.data();
        if (!regulation.deadline) return;

        const deadline = regulation.deadline.toDate
          ? regulation.deadline.toDate()
          : new Date(regulation.deadline);

        if (deadline < now) {
          overdue.push({
            id: doc.id,
            ...regulation,
            deadline: deadline,
            daysOverdue: Math.ceil(
              (now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)
            ),
          });
        }
      });

      return overdue;
    } catch (error) {
      console.error("Error getting overdue regulations:", error);
      throw error;
    }
  }

  /**
   * Get regulations due within specified days
   */
  async getUpcomingDeadlines(days = 7) {
    try {
      const now = new Date();
      const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const snapshot = await db
        .collection("regulations")
        .where("status", "!=", "Published")
        .get();

      const upcoming = [];

      snapshot.forEach((doc) => {
        const regulation = doc.data();
        if (!regulation.deadline) return;

        const deadline = regulation.deadline.toDate
          ? regulation.deadline.toDate()
          : new Date(regulation.deadline);

        if (deadline >= now && deadline <= targetDate) {
          const daysUntil = Math.ceil(
            (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          upcoming.push({
            id: doc.id,
            ...regulation,
            deadline: deadline,
            daysUntilDeadline: daysUntil,
          });
        }
      });

      return upcoming.sort((a, b) => a.deadline - b.deadline);
    } catch (error) {
      console.error("Error getting upcoming deadlines:", error);
      throw error;
    }
  }
}

module.exports = new DeadlineReminderService();

