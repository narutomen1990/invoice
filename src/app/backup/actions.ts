"use server";

import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");

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

export async function listBackupsAction(): Promise<BackupFile[]> {
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

export async function createBackupAction(): Promise<{ error?: string; ok?: boolean; filename?: string }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") return { error: "เฉพาะ admin เท่านั้น" };

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
        revalidatePath("/backup");
        resolve({ ok: true, filename });
      }
    });
    proc.on("error", (err) => {
      resolve({ error: `pg_dump not available: ${err.message}` });
    });
  });
}

export async function deleteBackupAction(filename: string): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") return { error: "เฉพาะ admin เท่านั้น" };

  // safety: filename must not contain path separators
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return { error: "ชื่อไฟล์ไม่ถูกต้อง" };
  }
  await unlink(path.join(BACKUP_DIR, filename));
  revalidatePath("/backup");
  return { ok: true };
}

export async function getBackupDirAction(): Promise<string> {
  return BACKUP_DIR;
}
