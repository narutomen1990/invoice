"use server";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { importInvoicesFromDbf, type ImportResult } from "@/lib/etl/import-invoices";
import {
  BACKUP_DIR,
  BACKUP_RETENTION_DAYS,
  listBackups,
  runBackup,
  deleteBackupFile,
  cleanupOldBackups,
  type BackupFile,
} from "@/lib/backup/core";

export async function listBackupsAction(): Promise<BackupFile[]> {
  return listBackups();
}

export async function createBackupAction(): Promise<{ error?: string; ok?: boolean; filename?: string }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") return { error: "เฉพาะ admin เท่านั้น" };

  const result = await runBackup();
  if (result.ok) {
    await cleanupOldBackups(BACKUP_RETENTION_DAYS);
    revalidatePath("/backup");
  }
  return result;
}

export async function deleteBackupAction(filename: string): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") return { error: "เฉพาะ admin เท่านั้น" };

  try {
    await deleteBackupFile(filename);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/backup");
  return { ok: true };
}

export async function getBackupDirAction(): Promise<string> {
  return BACKUP_DIR;
}

/**
 * Import NEW invoices from an uploaded FoxPro Invoice.DBF (+ optional .FPT).
 * Skips invoices whose doc_no is already present. Other tables are untouched.
 */
export async function importInvoicesFromFoxProAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; result?: ImportResult }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") return { error: "เฉพาะ admin เท่านั้น" };

  const dbfFile = formData.get("dbf");
  const fptFile = formData.get("fpt");
  if (!(dbfFile instanceof File) || dbfFile.size === 0) {
    return { error: "กรุณาเลือกไฟล์ Invoice.DBF" };
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "invoice-dbf-import-"));
  const basePath = path.join(tmpDir, "Invoice");
  try {
    await writeFile(`${basePath}.DBF`, Buffer.from(await dbfFile.arrayBuffer()));
    if (fptFile instanceof File && fptFile.size > 0) {
      await writeFile(`${basePath}.FPT`, Buffer.from(await fptFile.arrayBuffer()));
    }
    const result = await importInvoicesFromDbf(`${basePath}.DBF`);
    revalidatePath("/backup");
    revalidatePath("/invoices");
    revalidatePath("/");
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Import ไม่สำเร็จ: ${msg}` };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
