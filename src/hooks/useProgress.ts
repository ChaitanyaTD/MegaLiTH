"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";

export type ProgressRecord = {
  id: number;
  address: string;
  xState: number;
  tgState: number;
  refState: number;
  referralCode?: string | null;
  createdAt: string;
  updatedAt: string;
} | null;

export type TaskState = 0 | 1 | 2;

export function useProgress() {
  const { address } = useAccount();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["progress", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(`/api/progress?address=${address}`);
      return (await res.json()) as ProgressRecord;
    },
    enabled: !!address,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });

  const upsert = useMutation({
    mutationFn: async (updates: Partial<{ xState: number; tgState: number; refState: number }>) => {
      if (!address) return null;
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, ...updates }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Update cache immediately so button states reflect without waiting for poll
      qc.setQueryData(["progress", address], data as ProgressRecord);
    },
  });

  return { ...q, upsert };
}


