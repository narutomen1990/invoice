"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Trash2,
  Save,
  X,
  Pencil,
  User as UserIcon,
  Lock,
  IdCard,
  ShieldCheck,
  ToggleLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  createUserAction,
  updateUserAction,
  deleteUserAction,
} from "./actions";

type UserRow = {
  id: number;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  isLegacy: boolean;
};

const ROLES = [
  { value: "admin", label: "admin" },
  { value: "manager", label: "manager" },
  { value: "staff", label: "staff" },
  { value: "viewer", label: "viewer" },
];

export function UserManagement({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: number;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div>
      {/* Top action bar */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          รายชื่อผู้ใช้งาน
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-blue-700/20 transition hover:from-blue-600 hover:to-blue-700 active:translate-y-px"
          >
            <UserPlus className="h-4 w-4" />
            เพิ่มผู้ใช้ใหม่
          </button>
        )}
      </div>

      {showAdd && (
        <AddUserPanel
          onCancel={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            refresh();
          }}
        />
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-3">ชื่อผู้ใช้</th>
              <th className="px-4 py-3">ชื่อเต็ม</th>
              <th className="px-4 py-3">สิทธิ์</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">เข้าใช้ล่าสุด</th>
              <th className="px-5 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map((u) => (
                <tr key={u.id} className="group transition hover:bg-blue-50/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.username} active={u.isActive} />
                      <div className="flex flex-col">
                        <span className="font-mono text-[13px] font-semibold text-zinc-900">
                          {u.username}
                        </span>
                        {u.id === currentUserId && (
                          <span className="text-[10px] font-medium text-blue-600">
                            ● บัญชีของคุณ
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{u.fullName || "—"}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          เปิดใช้งาน
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 ring-1 ring-zinc-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                          ปิดใช้งาน
                        </span>
                      )}
                      {u.isLegacy && (
                        <Badge variant="warning" className="text-[10px]">
                          legacy
                        </Badge>
                      )}
                      {u.mustChangePassword && (
                        <Badge variant="warning" className="text-[10px]">
                          ต้องเปลี่ยนรหัส
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString("th-TH")
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <IconButton
                        title="แก้ไข"
                        onClick={() => setEditing(u.id)}
                        color="blue"
                      >
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <DeleteUserButton
                        id={u.id}
                        username={u.username}
                        disabled={u.id === currentUserId}
                        onDone={refresh}
                      />
                    </div>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <EditUserDialog
          user={users.find((u) => u.id === editing)!}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------
 * Add user — fancy gradient panel
 * --------------------------------------------------------------------- */
function AddUserPanel({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("staff");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("username", username);
    fd.set("password", password);
    fd.set("fullName", fullName);
    fd.set("role", role);
    startTransition(async () => {
      const res = await createUserAction(fd);
      if (res?.error) setError(res.error);
      else onSaved();
    });
  }

  return (
    <div className="border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 px-5 py-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-900">
        <UserPlus className="h-4 w-4" />
        เพิ่มผู้ใช้ใหม่
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Field label="ชื่อผู้ใช้" icon={<UserIcon className="h-4 w-4" />}>
          <ModernInput
            placeholder="เช่น john.doe"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="รหัสผ่าน" icon={<Lock className="h-4 w-4" />}>
          <ModernInput
            type="password"
            placeholder="อย่างน้อย 6 ตัว"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="ชื่อเต็ม" icon={<IdCard className="h-4 w-4" />}>
          <ModernInput
            placeholder="ชื่อ-นามสกุล"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>
        <Field label="สิทธิ์การใช้งาน" icon={<ShieldCheck className="h-4 w-4" />}>
          <ModernSelect value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </ModernSelect>
        </Field>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-lime-600/30 transition hover:bg-lime-600 active:translate-y-px disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button
          onClick={onCancel}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:translate-y-px disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------
 * Edit user (modal popup)
 * --------------------------------------------------------------------- */
function EditUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [fullName, setFullName] = useState(user.fullName);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("username", username);
    fd.set("fullName", fullName);
    fd.set("password", password);
    fd.set("role", role);
    fd.set("isActive", isActive ? "1" : "0");
    startTransition(async () => {
      const res = await updateUserAction(user.id, fd);
      if (res?.error) setError(res.error);
      else onSaved();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-gradient-to-b from-blue-50 to-white px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-white">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                แก้ไขข้อมูลผู้ใช้
              </div>
              <div className="font-mono text-[11px] text-zinc-500">
                ID: {user.id}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="ปิด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <Field label="ชื่อผู้ใช้" icon={<UserIcon className="h-4 w-4" />}>
            <ModernInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </Field>

          <Field label="ชื่อเต็ม" icon={<IdCard className="h-4 w-4" />}>
            <ModernInput
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="ชื่อ-นามสกุล"
            />
          </Field>

          <Field
            label="รหัสผ่านใหม่ (ปล่อยว่างถ้าไม่เปลี่ยน)"
            icon={<Lock className="h-4 w-4" />}
          >
            <ModernInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="อย่างน้อย 6 ตัว"
              autoComplete="new-password"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="สิทธิ์" icon={<ShieldCheck className="h-4 w-4" />}>
              <ModernSelect
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </ModernSelect>
            </Field>

            <Field label="สถานะ" icon={<ToggleLeft className="h-4 w-4" />}>
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 shadow-sm">
                <span className="relative inline-block h-5 w-9">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="absolute inset-0 rounded-full bg-zinc-300 transition peer-checked:bg-blue-600" />
                  <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                </span>
                <span className="text-xs font-medium text-zinc-700">
                  {isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                </span>
              </label>
            </Field>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3">
          <button
            onClick={onClose}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            ยกเลิก
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-lime-600/30 transition hover:bg-lime-600 active:translate-y-px disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------
 * Action buttons
 * --------------------------------------------------------------------- */
function DeleteUserButton({
  id,
  username,
  disabled,
  onDone,
}: {
  id: number;
  username: string;
  disabled?: boolean;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  function onClick() {
    if (
      !confirm(
        `ลบบัญชี "${username}" ออกจากระบบ?\n(ถ้ามีข้อมูลอ้างอิงจะถูกปิดใช้งานแทน)`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteUserAction(id);
      if (res?.softDisabled && res?.error) {
        alert(res.error);
        onDone();
      } else if (res?.error) {
        alert(res.error);
      } else {
        onDone();
      }
    });
  }
  return (
    <IconButton
      title={disabled ? "ลบบัญชีตัวเองไม่ได้" : "ลบ"}
      onClick={onClick}
      disabled={disabled || pending}
      color="red"
    >
      <Trash2 className="h-4 w-4" />
    </IconButton>
  );
}

/* -----------------------------------------------------------------------
 * Building blocks
 * --------------------------------------------------------------------- */
function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
        {icon && <span className="text-blue-600">{icon}</span>}
        {label}
      </span>
      {children}
    </label>
  );
}

function ModernInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 " +
        (props.className ?? "")
      }
    />
  );
}

function ModernSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    children: React.ReactNode;
  },
) {
  const { children, className, ...rest } = props;
  return (
    <select
      {...rest}
      className={
        "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 " +
        (className ?? "")
      }
    >
      {children}
    </select>
  );
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
  color,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  color: "blue" | "amber" | "red";
}) {
  const colorMap = {
    blue: "text-blue-600 hover:bg-blue-50 hover:text-blue-700",
    amber: "text-amber-600 hover:bg-amber-50 hover:text-amber-700",
    red: "text-red-500 hover:bg-red-50 hover:text-red-700",
  } as const;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${colorMap[color]}`}
    >
      {children}
    </button>
  );
}

function Avatar({ name, active }: { name: string; active: boolean }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div
      className={
        "relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-white " +
        (active
          ? "bg-gradient-to-br from-blue-500 to-blue-700 shadow-sm"
          : "bg-zinc-300")
      }
    >
      {initial}
      <span
        className={
          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white " +
          (active ? "bg-emerald-500" : "bg-zinc-400")
        }
      />
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin:
      "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
    manager:
      "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    staff: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200",
    viewer:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  };
  const cls = map[role] ?? map.staff;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      {role}
    </span>
  );
}
