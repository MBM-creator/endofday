import type { Metadata } from "next";
import "./globals.css";

// Avoid static caching so clients get latest HTML/JS (reduces cached old draft-first flow).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Reports - Made By Mobbs",
  description: "Daily site report submission",
};

export const viewport = { themeColor: "#0F172A" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
