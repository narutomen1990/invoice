"use server";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  importInvoicesFromDbf,
  deleteAllInvoicesAndCreditNotes,
  type ImportResult,
} from "@/lib/etl/import-invoices";
import {
  BACKUP_DIR,
  BACKUP_RETENTION_DAYS,
  listBackups,
  runBackup,
  runRestore,
  deleteBackupFile,
  cleanupOldBackups,
  saveUploadedBackup,
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

/** Restores the database from a backup file. Destructive — overwrites all live data. Admin only. */
export async function restoreBackupAction(filename: string): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") return { error: "เฉพาะ admin เท่านั้นที่ restore ได้" };

  const result = await runRestore(filename);
  if (result.ok) revalidatePath("/backup");
  return result;
}

/** Uploads a backup file (.dump/.sql.gz) from the admin's computer into BACKUP_DIR
 * so it appears in the list and can be restored via restoreBackupAction. */
export async function uploadBackupAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; filename?: string }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") return { error: "เฉพาะ admin เท่านั้น" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "กรุณาเลือกไฟล์ backup (.dump หรือ .sql.gz)" };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await saveUploadedBackup(file.name, buf);
  if (result.ok) revalidatePath("/backup");
  return result;
}

/**
 * Import invoices from an uploaded FoxPro Invoice.DBF (+ optional .FPT).
 * By default skips doc_no's already present. When `replaceAll` is set,
 * first permanently deletes every existing invoice/credit-note document
 * (customers/products/other doc types untouched) so the file becomes the
 * sole source of truth — admin only, irreversible.
 */
export async function importInvoicesFromFoxProAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; result?: ImportResult; deletedCount?: number }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") return { error: "เฉพาะ admin เท่านั้น" };

  const dbfFile = formData.get("dbf");
  const fptFile = formData.get("fpt");
  const replaceAll = formData.get("replaceAll") === "1";
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

    let deletedCount: number | undefined;
    if (replaceAll) {
      deletedCount = (await deleteAllInvoicesAndCreditNotes()).deletedCount;
    }

    const result = await importInvoicesFromDbf(`${basePath}.DBF`);
    revalidatePath("/backup");
    revalidatePath("/invoices");
    revalidatePath("/credit-notes");
    revalidatePath("/");
    return { ok: true, result, deletedCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Import ไม่สำเร็จ: ${msg}` };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
