import type { Metadata } from "next";
import { Parkinsans, Nunito_Sans } from "next/font/google";
import "./globals.scss";

// Header/heading font vs. body font, per docs/design/screenshots/Home-1.png.
// Exposed as CSS custom properties and consumed by globals.scss's Bootstrap
// $headings-font-family / $font-family-base overrides.
const parkinsans = Parkinsans({ subsets: ["latin"], variable: "--font-heading" });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Cycle Network Grow",
  description: "Join cycling events, connect Strava, and climb the leaderboard.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${parkinsans.variable} ${nunitoSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
