import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DollarCord",
  description:
    "A real-time Discord-inspired chat app with servers, channels, DMs, presence, reactions, pins, and settings.",
  manifest: "/manifest.webmanifest",
  applicationName: "DollarCord",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "DollarCord" },
};

export const viewport: Viewport = {
  themeColor: "#1e1f22",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dc-chat text-dc-text antialiased">
        {children}
      </body>
    </html>
  );
}
