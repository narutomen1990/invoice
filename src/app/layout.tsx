import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบใบกำกับภาษี",
  description: "ระบบออกใบกำกับภาษี / ใบเสนอราคา / ใบวางบิล",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
