"use client";

import { ReactNode, useEffect } from "react";
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
  appName: "Megalith",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "demo",
  chains: [base],
  ssr: true,
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_WALLETCONNECT_ID || process.env.NEXT_PUBLIC_WALLETCONNECT_ID === "demo") {
      console.warn("Using demo WalletConnect projectId. Set NEXT_PUBLIC_WALLETCONNECT_ID in .env.local for production.");
    }
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()} coolMode>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}


