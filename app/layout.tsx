import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { IconSprite } from "@/components/icons/IconSprite";
import { Sidebar } from "@/components/shell/Sidebar";
import { ToastDock } from "@/components/nudges/ToastDock";
import { NudgeProvider } from "@/lib/nudge-context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AxionHR",
  description: "HR wellbeing prototype — burnout analytics, nudges, mood, boundaries, kudos, and focus mode.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg text-ink">
        <IconSprite />
        <NudgeProvider>
          <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar />
            <main className="flex-1 min-w-0">{children}</main>
          </div>
          <ToastDock />
        </NudgeProvider>
      </body>
    </html>
  );
}
