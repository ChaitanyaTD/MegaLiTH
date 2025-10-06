"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import KiltBalance from "@/components/KiltBalance";
import TaskButtons from "./TaskButtons";
import { useProgress } from "@/hooks/useProgress";

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { data, isFetched } = useProgress();
  const didInitRef = useRef(false);
  const [userReady, setUserReady] = useState(false);
  const [referralLink, setReferralLink] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      router.replace("/");
      return;
    }
    if (!didInitRef.current && isFetched) {
      didInitRef.current = true;
      // Check if user exists first; only create if missing
      fetch(`/api/user?address=${address}`)
        .then(async (r) => (r.ok ? r.json() : null))
        .then(async (existing) => {
          if (existing?.id) {
            setUserReady(true);
            return;
          }
          const r = await fetch("/api/user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address }),
          });
          if (r.ok) setUserReady(true);
        })
        .catch(() => {});
    }

  }, [isConnected, router, isFetched, data, address]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center max-w-6xl mx-auto">
        
      </div>

      <div className="max-w-6xl mx-auto grid gap-8">
        <section>
          <h2 className="heading text-2xl font-semibold">Genesis Drop</h2>
          <div className="mt-4 grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm opacity-80 mb-1">KILT balance</label>
              <div className="w-full card rounded-md p-3 font-mono">
                <KiltBalance />
              </div>
            </div>
            <div>
              <label className="block text-sm opacity-80 mb-1">M1 allocation</label>
              <input className="w-full card rounded-md p-3 font-mono" value={"34,420.00"} readOnly />
            </div>
          </div>
          <p className="mt-4 opacity-80 text-sm">The snapshot is scheduled for Block 3482000 around 12:00 on October 20th, 2025.</p>
        </section>

        <section className="mt-10">
          <h2 className="heading text-2xl font-semibold">Alliance Drop</h2>
          <TaskButtons disabled={!userReady}  setReferralLink={setReferralLink}/>
          <div className="mt-10">
            <p className="text-xl font-semibold">Your unique referral link: <span className="font-normal">{referralLink}</span></p>
            <div className="mt-4">
              <button className="btn btn-primary text-black font-bold rounded-xl px-6 py-3">Register</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}