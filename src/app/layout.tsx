import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import ThemeToggle from "./components/ThemeToggle";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Toaster } from 'react-hot-toast';
import Image from "next/image";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MegaLITH",
  description: "Your airdrop portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <header className="p-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Image src="/assets/megalith-wordmark-ob.png" alt="Megalith" className="h-8 logo-light" />
              <Image src="/assets/megalith-wordmark-ow.png" alt="Megalith" className="h-8 logo-dark" />
            </div>
            <div className="flex items-center space-x-3">
              <ThemeToggle />
              <ConnectButton 
                accountStatus={{ smallScreen: "avatar", largeScreen: "full" }} 
                showBalance={{ largeScreen: true, smallScreen: false }} 
              />
            </div>
          </header>

          <main>{children}</main>
          <Toaster position="top-right" reverseOrder={false} />
        </Providers>
      </body>
    </html>
  );
}
