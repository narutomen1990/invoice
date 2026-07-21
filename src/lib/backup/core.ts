import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

export const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
export const BACKUP_RETENTION_DAYS = 10;

function getDbConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || "5432",
    user: u.username,
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export type BackupFile = {
  name: string;
  size: number;
  createdAt: string;
};

export async function listBackups(): Promise<BackupFile[]> {
  await mkdir(BACKUP_DIR, { recursive: true });
  const entries = await readdir(BACKUP_DIR);
  const result: BackupFile[] = [];
  for (const f of entries) {
    if (!f.endsWith(".dump") && !f.endsWith(".sql.gz")) continue;
    const s = await stat(path.join(BACKUP_DIR, f));
    result.push({ name: f, size: s.size, createdAt: s.mtime.toISOString() });
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Runs pg_dump into BACKUP_DIR. No session/auth check — callers decide who may invoke it. */
export async function runBackup(): Promise<{ error?: string; ok?: boolean; filename?: string }> {
  await mkdir(BACKUP_DIR, { recursive: true });
  const cfg = getDbConfig();
  const filename = `invoice_${timestamp()}.dump`;
  const filepath = path.join(BACKUP_DIR, filename);

  return new Promise((resolve) => {
    const proc = spawn(
      "pg_dump",
      [
        "-h", cfg.host,
        "-p", cfg.port,
        "-U", cfg.user,
        "-d", cfg.database,
        "-F", "custom",
        "-Z", "9",
        "-f", filepath,
      ],
      { env: { ...process.env, PGPASSWORD: cfg.password } },
    );
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({ error: `pg_dump failed: ${stderr.slice(0, 300)}` });
      } else {
        resolve({ ok: true, filename });
      }
    });
    proc.on("error", (err) => {
      resolve({ error: `pg_dump not available: ${err.message}` });
    });
  });
}

function safeBackupPath(filename: string): string {
  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..")
  ) {
    throw new Error("ชื่อไฟล์ไม่ถูกต้อง");
  }
  if (!filename.endsWith(".dump") && !filename.endsWith(".sql.gz")) {
    throw new Error("ไม่ใช่ไฟล์สำรองที่รองรับ");
  }
  return path.join(BACKUP_DIR, filename);
}

export async function deleteBackupFile(filename: string): Promise<void> {
  await unlink(safeBackupPath(filename));
}

/** Absolute path to a backup file inside BACKUP_DIR. Throws if the filename looks unsafe. */
export function resolveBackupPath(filename: string): string {
  return safeBackupPath(filename);
}

/** Restores the database from a .dump file via pg_restore -c --if-exists. Destructive — overwrites live data. */
export async function runRestore(filename: string): Promise<{ error?: string; ok?: boolean }> {
  let filepath: string;
  try {
    filepath = safeBackupPath(filename);
    await stat(filepath);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ไม่พบไฟล์สำรองนี้" };
  }

  const cfg = getDbConfig();

  return new Promise((resolve) => {
    const proc = spawn(
      "pg_restore",
      [
        "-h", cfg.host,
        "-p", cfg.port,
        "-U", cfg.user,
        "-d", cfg.database,
        "-c",
        "--if-exists",
        filepath,
      ],
      { env: { ...process.env, PGPASSWORD: cfg.password } },
    );
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({ error: `pg_restore failed (code ${code}): ${stderr.slice(0, 500)}` });
      } else {
        resolve({ ok: true });
      }
    });
    proc.on("error", (err) => {
      resolve({ error: `pg_restore not available: ${err.message}` });
    });
  });
}

/** Deletes backup files older than `retentionDays`. Returns the filenames removed. */
export async function cleanupOldBackups(retentionDays: number): Promise<string[]> {
  const files = await listBackups();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const removed: string[] = [];
  for (const f of files) {
    if (new Date(f.createdAt).getTime() < cutoff) {
      await unlink(path.join(BACKUP_DIR, f.name));
      removed.push(f.name);
    }
  }
  return removed;
}
