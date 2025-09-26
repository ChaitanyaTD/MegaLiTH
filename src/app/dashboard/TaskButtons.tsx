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
        completed
          ? "bg-green-700"
          : disabled
          ? "bg-[#101214] opacity-50 cursor-not-allowed"
          : "bg-[#1f2326] hover:bg-[#262a2d]"
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

  const handleFollowX = async () => {
    if (!address || pending) return;
    setPending("x");
    try {
      // Redirect user to X OAuth
      const res = await fetch(`/api/twitter/auth?address=${address}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "no body");
        console.error("Twitter auth request failed:", res.status, txt);
        alert("Failed to start X OAuth");
        return;
      }
      const payload = await res.json().catch(() => null);
      const url = payload?.url;
      console.log("Twitter auth response:", url);
      if (!url) {
        console.error("Invalid /api/twitter/auth response:", payload);
        alert("Invalid OAuth response");
        return;
      }
      // use assign so browser back works predictably
      window.location.assign(url);
      // Actual state update happens after callback handled in /api/twitter/callback
    } catch (err) {
      console.error(err);
      alert("Failed to start X OAuth");
    } finally {
      setPending(null);
    }
  };

  const handleJoinTG = async () => {
    if (!address || pending) return;
    setPending("tg");
    try {
      // Telegram verification flow
      const telegramUserId = prompt("Enter your Telegram User ID for verification");
      if (!telegramUserId) throw new Error("Telegram ID required");
      const res = await fetch("/api/telegram/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ address, telegramUserId }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "no body");
        console.error("Telegram verify failed:", res.status, txt);
        alert("Telegram verification failed");
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.verified) await upsert.mutateAsync({ tgState: 2, refState: 1 });
      else alert("Telegram not verified");
    } catch (err) {
      console.error(err);
    } finally {
      setPending(null);
    }
  };

  const handleGetReferral = async () => {
    if (!address || pending) return;
    setPending("ref");
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "no body");
        console.error("Referral request failed:", res.status, txt);
        alert("Failed to generate referral");
        return;
      }
      const referral = await res.json().catch(() => null);
      console.log("Referral generated:", referral);
      await upsert.mutateAsync({ refState: 2 });
    } catch (err) {
      console.error(err);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 opacity-100">
      <Btn state={disabled || pending === "x" ? 0 : xState} onClick={!disabled && xState === 1 ? handleFollowX : undefined}>
        Follow Megalith on X
      </Btn>
      <Btn state={disabled || pending === "tg" ? 0 : tgState} onClick={!disabled && tgState === 1 ? handleJoinTG : undefined}>
        Join Telegram
      </Btn>
      <Btn state={disabled || pending === "ref" ? 0 : refState} onClick={!disabled && refState === 1 ? handleGetReferral : undefined}>
        Reveal Referral Link
      </Btn>
    </div>
  );
}
