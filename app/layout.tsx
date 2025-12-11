import type { Metadata, Viewport } from "next";
import "./globals.css";

/// @notice Viewport configuration for mobile-first layout
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

/// @notice Metadata for the Look Wallet application
export const metadata: Metadata = {
  title: "Look Wallet",
  description: "Mobile wallet for $LOOK token powered by MetaKeep",
  icons: {
    icon: "/lookcoin.png",
    shortcut: "/lookcoin.png",
    apple: "/lookcoin.png",
  },
};

/**
 * @notice Root layout component for Next.js app
 * @dev Optimized for mobile screens (6.1-6.9 inches)
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

