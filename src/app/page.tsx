"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) router.replace("/dashboard");
  }, [isConnected, router]);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="text-center max-w-4xl">
        <h1 className="heading text-5xl sm:text-6xl font-semibold tracking-wide">MEGALITH</h1>
        <p className="mt-4 text-xl sm:text-2xl opacity-80">Unified on-chain identity & payments for agents, users, and enterprises.</p>
        <p className="mt-3 text-2xl sm:text-3xl font-semibold">Secure, scalable, and DeFi-ready.</p>
      </div>
    </div>
  );
}
