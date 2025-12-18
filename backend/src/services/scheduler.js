const cron = require("node-cron");
const deadlineReminderService = require("./deadlineReminder");

/**
 * Scheduled jobs for deadline reminders and SLA monitoring
 */
class SchedulerService {
  constructor() {
    this.jobs = [];
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    console.log("Starting scheduled jobs...");

    // Check deadlines every day at 9 AM
    const deadlineCheckJob = cron.schedule("0 9 * * *", async () => {
      console.log("Running daily deadline check...");
      try {
        const result = await deadlineReminderService.checkUpcomingDeadlines();
        console.log(
          `Deadline check completed: ${result.reminders.length} reminders, ${result.overdue.length} overdue`
        );
      } catch (error) {
        console.error("Error in deadline check job:", error);
      }
    });

    this.jobs.push(deadlineCheckJob);

    // Check deadlines every 6 hours for more frequent monitoring
    const frequentCheckJob = cron.schedule("0 */6 * * *", async () => {
      console.log("Running frequent deadline check...");
      try {
        await deadlineReminderService.checkUpcomingDeadlines();
      } catch (error) {
        console.error("Error in frequent deadline check job:", error);
      }
    });

    this.jobs.push(frequentCheckJob);

    console.log("Scheduled jobs started");
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
    console.log("Scheduled jobs stopped");
  }
}

module.exports = new SchedulerService();

