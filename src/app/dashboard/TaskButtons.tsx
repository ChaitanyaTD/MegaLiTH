"use client";

import { useProgress } from "@/hooks/useProgress";
import { useState } from "react";
import { useAccount } from "wagmi";

function Btn({ state, onClick, children }: { state: number; onClick?: () => void; children: React.ReactNode }) {
  const disabled = state === 0;
  const completed = state === 2;
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl p-6 text-xl font-semibold transition-colors ${
        completed ? "bg-green-700" : disabled ? "bg-[#101214] opacity-50 cursor-not-allowed" : "bg-[#1f2326] hover:bg-[#262a2d]"
      }`}
    >
      {children}
    </button>
  );
}

export default function TaskButtons({ disabled }: { disabled?: boolean }) {
  const { address } = useAccount();
  const { data, upsert } = useProgress();
  const [pending, setPending] = useState<null | "x" | "tg" | "ref">(null);

  const xState = data?.xState ?? 1;
  const tgState = data?.tgState ?? 0;
  const refState = data?.refState ?? 0;

  const onFollowX = async () => {
    if (pending) return;
    setPending("x");
    try {
      await upsert.mutateAsync({ xState: 2, tgState: 1 });
    } finally {
      setPending(null);
    }
    // In real impl, verify via X API webhook before marking complete
  };

  const onJoinTG = async () => {
    if (pending) return;
    setPending("tg");
    try {
      await upsert.mutateAsync({ tgState: 2, refState: 1 });
    } finally {
      setPending(null);
    }
    // In real impl, verify via Telegram bot before marking complete
  };

  const onGetReferral = async () => {
    if (pending) return;
    setPending("ref");
    await fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    try {
      await upsert.mutateAsync({ refState: 2 });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 opacity-100">
      <Btn state={disabled || pending === "x" ? 0 : xState} onClick={!disabled && xState === 1 ? onFollowX : undefined}>Follow Megalith on X</Btn>
      <Btn state={disabled || pending === "tg" ? 0 : tgState} onClick={!disabled && tgState === 1 ? onJoinTG : undefined}>Join Telegram</Btn>
      <Btn state={disabled || pending === "ref" ? 0 : refState} onClick={!disabled && refState === 1 ? onGetReferral : undefined}>Reveal Referral Link</Btn>
    </div>
  );
}


