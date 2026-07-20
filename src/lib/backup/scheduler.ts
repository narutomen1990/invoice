import cron from "node-cron";
import { runBackup, cleanupOldBackups, BACKUP_RETENTION_DAYS } from "./core";

export const BACKUP_CRON_SCHEDULE = "30 0 * * *"; // ทุกวัน เวลา 00:30 (หลังเที่ยงคืน)

let started = false;

/** Starts the once-daily auto-backup job. Safe to call more than once — only the first call registers the cron task. */
export function startBackupScheduler() {
  if (started) return;
  started = true;

  cron.schedule(
    BACKUP_CRON_SCHEDULE,
    async () => {
      const result = await runBackup();
      if (result.error) {
        console.error("[backup-scheduler] pg_dump failed:", result.error);
      } else {
        console.log("[backup-scheduler] created", result.filename);
      }

      const removed = await cleanupOldBackups(BACKUP_RETENTION_DAYS);
      if (removed.length > 0) {
        console.log("[backup-scheduler] removed backups older than", BACKUP_RETENTION_DAYS, "days:", removed);
      }
    },
    { timezone: "Asia/Bangkok" },
  );

  console.log(
    `[backup-scheduler] daily auto-backup scheduled (${BACKUP_CRON_SCHEDULE} Asia/Bangkok), retention ${BACKUP_RETENTION_DAYS} days`,
  );
}
