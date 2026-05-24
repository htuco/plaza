import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PreferenceScript } from "@/components/preference-script";
import { PreferencesProvider } from "@/components/preferences-provider";
import { PreferencesSwitcher } from "@/components/preferences-switcher";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plaza — party games for the crew",
  description: "Jump into a room, send a code, start playing.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <PreferenceScript />
      </head>
      <body className="min-h-full flex flex-col">
        <PreferencesProvider>
          <PreferencesSwitcher />
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
