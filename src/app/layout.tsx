import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRACKR — Crypto Trading Intelligence Terminal",
  description:
    "Bloomberg-style intelligence for crypto day traders. Portfolio risk, smart money tracking, and discipline for spot + perps.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
