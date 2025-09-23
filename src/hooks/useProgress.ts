"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";

export type TaskState = 0 | 1 | 2;

export function useProgress() {
  const { address } = useAccount();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["progress", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(`/api/progress?address=${address}`);
      return (await res.json()) as any | null;
    },
    enabled: !!address,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["progress", address] }),
  });

  return { ...q, upsert };
}


