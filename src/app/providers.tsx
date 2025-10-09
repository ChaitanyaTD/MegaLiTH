"use client";

import React, { ReactNode, useEffect } from "react";
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
  lightTheme,
  Theme,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { base, bsc } from "wagmi/chains";
import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
  appName: "Megalith",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "demo",
  chains: [base, bsc],
  ssr: true,
});

const queryClient = new QueryClient();

function getInitialMode(): "light" | "dark" {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_WALLETCONNECT_ID || process.env.NEXT_PUBLIC_WALLETCONNECT_ID === "demo") {
      console.warn("Using demo WalletConnect projectId. Set NEXT_PUBLIC_WALLETCONNECT_ID in .env.local for production.");
    }
  }, []);

  // Avoid hydration mismatches: wait until mounted to compute theme
  const [mounted, setMounted] = React.useState(false);
  const [mode, setMode] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    setMounted(true);
    const update = () => setMode(getInitialMode());
    update();
    const observer = new MutationObserver(update);
    if (typeof document !== "undefined") {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
    return () => observer.disconnect();
  }, []);

  const isDark = mode === "dark";
  const brand = "#f26522"; // Always orange for all themes
  const base = isDark
    ? darkTheme({ accentColor: brand, accentColorForeground: "#ffffff", borderRadius: "large" })
    : lightTheme({ accentColor: brand, accentColorForeground: "#ffffff", borderRadius: "large" });

  // Ensure connected button uses brand color too
  const rkTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      accentColor: brand,
      accentColorForeground: "#ffffff",
      connectButtonBackground: brand,
      connectButtonText: "#ffffff",
      connectButtonInnerBackground: brand,
      profileAction: brand,
      profileActionHover: brand,
      selectedOptionBorder: brand,
      closeButton: isDark ? "#ffffff" : "#000000",
    },
  } as Theme;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {mounted ? (
          <RainbowKitProvider theme={rkTheme}>
            {children}
          </RainbowKitProvider>
        ) : (
          children
        )}
      </QueryClientProvider>
    </WagmiProvider>
  );
}


