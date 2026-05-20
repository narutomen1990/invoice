import { NextResponse, type NextRequest } from "next/server";
import { verifySessionEdge, AUTH_COOKIE_NAME } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/login-bg.jpg", "/login-logo.jpg"];
const PUBLIC_PREFIXES = [
  "/_next",
  "/api/auth",
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
  const valid = await verifySessionEdge(token);
  if (!valid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
