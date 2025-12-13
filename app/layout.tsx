import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Look Wallet",
  description: "A modern Solana wallet application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

