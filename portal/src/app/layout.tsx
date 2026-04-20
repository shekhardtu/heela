import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hee — Custom domains for SaaS",
  description:
    "Open-source edge for SaaS custom domains. Free Let's Encrypt certs, multi-region, zero Cloudflare Enterprise.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
