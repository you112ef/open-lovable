import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Open Lovable",
  description: "Re-imagine any website in seconds with AI-powered website builder.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">
        <Suspense>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
