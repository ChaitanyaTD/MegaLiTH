"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import KiltBalance from "@/components/KiltBalance";
import TaskButtons from "./TaskButtons";
import { useProgress } from "@/hooks/useProgress";

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { data, isFetched, upsert } = useProgress();
  const didInitRef = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      router.replace("/");
      return;
    }
    if (!didInitRef.current && isFetched && !data && !upsert.isPending) {
      didInitRef.current = true;
      upsert.mutate({});
    }

  }, [isConnected, router, isFetched, data, upsert.isPending]);

  return (
    <div className="min-h-screen bg-[#2f3538] text-white px-6 py-10">
      <div className="flex justify-between items-center max-w-6xl mx-auto">
        <h1 className="text-4xl font-extrabold">MEGALITH</h1>
        <div className="bg-[#3b3f42] rounded-xl p-2">
          <ConnectButton accountStatus={{ smallScreen: "avatar", largeScreen: "full" }} showBalance={false} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-12 grid gap-8">
        <section>
          <h2 className="text-2xl font-bold">Genesis Drop</h2>
          <div className="mt-4 grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm opacity-80 mb-1">KILT balance</label>
              <div className="w-full bg-[#1f2326] rounded-md p-3 font-mono">
                <KiltBalance />
              </div>
            </div>
            <div>
              <label className="block text-sm opacity-80 mb-1">M1 allocation</label>
              <input className="w-full bg-[#1f2326] rounded-md p-3 font-mono" value={"34,420.00"} readOnly />
            </div>
          </div>
          <p className="mt-4 opacity-80 text-sm">The snapshot is scheduled for Block 3482000 around 12:00 on October 20th, 2025.</p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Alliance Drop</h2>
          <TaskButtons />
          <div className="mt-10">
            <p className="text-xl font-semibold">Your unique referral link:</p>
            <div className="mt-4">
              <button className="bg-[#8fbf26] text-black font-bold rounded-xl px-6 py-3">Register</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}