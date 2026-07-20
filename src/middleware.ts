import { NextResponse, type NextRequest } from "next/server";
import { decodeSessionEdge, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { isPathAllowedForRole, defaultHomeForRole } from "@/lib/auth/access";

const PUBLIC_PATHS = ["/login", "/login-bg.jpg", "/login-logo.jpg"];
const PUBLIC_PREFIXES = [
  "/_next",
  "/api/auth",
  // /api/external ยืนยันตัวตนด้วย Authorization: Bearer <EXTERNAL_API_KEY> เอง
  // ในตัว route handler แทน cookie session — ไม่ใช่ endpoint สำหรับ browser
  "/api/external",
  "/favicon",
  "/fonts",
  "/uploads/vm-logo",
  "/uploads/company-logo",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await decodeSessionEdge(token);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!isPathAllowedForRole(session.role, pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = defaultHomeForRole(session.role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
