"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";

export type BoostData = {
  boostCoefficient: number;
  hasBnbBoost: boolean;
  hasAsterBoost: boolean;
  hasKiltBoost: boolean;
  hasBnbTokens: boolean;
  hasAsterTokens: boolean;
  hasKiltTokens: boolean;
  balances: {
    bnb: {
      wei: string;
      formatted: number;
    };
    aster: {
      wei: string;
      formatted: number;
    };
    kilt: {
      wei: string;
      formatted: number;
    };
  };
  lastUpdated: string | null;
};

export type UseBoostResult = {
  data: BoostData | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  calculateBoost: () => Promise<void>;
  isCalculating: boolean;
};

export function useBoost(): UseBoostResult {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["boost", address],
    queryFn: async (): Promise<BoostData> => {
      if (!address) throw new Error("No address");
      
      const response = await fetch(`/api/boost/calculate?address=${address}`);
      if (!response.ok) throw new Error("Failed to fetch boost");
      
      const result = await response.json();
      return result.data;
    },
    enabled: Boolean(address),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const calculateBoostMutation = useMutation({
    mutationFn: async (): Promise<BoostData> => {
      if (!address) throw new Error("No address");
      
      const response = await fetch("/api/boost/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      
      if (!response.ok) throw new Error("Failed to calculate boost");
      
      const result = await response.json();
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boost", address] });
      toast.success("Boost calculated successfully!");
    },
    onError: (error) => {
      console.error("Error calculating boost:", error);
      toast.error("Failed to calculate boost");
    },
  });

  const calculateBoost = async () => {
    await calculateBoostMutation.mutateAsync();
  };

  return {
    data: data || null,
    isLoading,
    isError,
    refetch,
    calculateBoost,
    isCalculating: calculateBoostMutation.isPending,
  };
}
