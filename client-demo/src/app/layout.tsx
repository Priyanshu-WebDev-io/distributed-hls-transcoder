import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Distributed Video Transcoder",
  description: "Distributed Video On Demand Transcoder with Adaptive Bitrate HLS Ladder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white">
        <nav className="w-full bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center z-50 sticky top-0 shadow-md">
          <div className="font-bold text-xl text-blue-500 tracking-wider">
            <Link href="/">TRANSCODE ENGINE</Link>
          </div>
          <div className="flex gap-4">
            <Link
              href="/upload"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
            >
              Upload & Transcode
            </Link>
            <Link
              href="/watch"
              className="px-4 py-2 bg-gray-800 rounded-md hover:bg-gray-700 transition-colors font-medium text-white shadow-sm"
            >
              Watch Gallery
            </Link>
          </div>
        </nav>
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
