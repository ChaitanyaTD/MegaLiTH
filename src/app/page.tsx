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
    <div className="min-h-screen bg-[#2f3538] text-white flex flex-col items-center justify-center gap-8 px-6">
      <div className="text-center max-w-4xl">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">MEGALITH</h1>
        <p className="mt-4 text-2xl opacity-80">Unified on-chain identity & payments for agents, users, and enterprises.</p>
        <p className="mt-2 text-3xl sm:text-4xl font-semibold">Secure, scalable, and DeFi-ready.</p>
      </div>
      <div className="mt-6">
        <ConnectButton showBalance={false} />
      </div>
    </div>
  );
}
