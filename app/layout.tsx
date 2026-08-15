import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { IconSprite } from "@/components/icons/IconSprite";

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
        {children}
      </body>
    </html>
  );
}
