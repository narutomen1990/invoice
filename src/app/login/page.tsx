import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div
      className="relative flex min-h-screen items-center justify-center p-4"
      style={{
        backgroundImage: "url(/login-bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/login-logo.jpg"
              alt="Logo"
              className="h-24 w-24 rounded-lg border-2 border-white object-cover shadow-lg"
            />
            <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              ระบบใบกำกับภาษี
            </h1>
          </div>
          <p className="text-sm font-medium text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            เข้าสู่ระบบเพื่อใช้งาน
          </p>
        </div>

        <LoginForm next={sp.next} initialError={sp.error} />
      </div>
    </div>
  );
}
