import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") || incoming.get("host") || "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og.png`;

  return {
    title: "LUMEN — Shader Instrument",
    description: "Shape procedural light in a live, playable WebGL studio.",
    applicationName: "LUMEN",
    authors: [{ name: "LUMEN Instruments" }],
    openGraph: {
      title: "LUMEN — Shader Instrument",
      description: "A live WebGL instrument for shaping procedural light, motion, matter, and color.",
      type: "website",
      images: [{ url: socialImage, width: 1200, height: 630, alt: "LUMEN Shader Instrument" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "LUMEN — Shader Instrument",
      description: "Shape procedural light in a live, playable WebGL studio.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
