"use client";

import { formatUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import { BNB_DECIMALS } from "@/lib/tokens";

export type UseBnbBalanceResult = {
  balanceWei?: bigint;
  balanceFormatted?: string;
  isLoading: boolean;
  isError: boolean;
  address?: `0x${string}`;
};

export function useBnbBalance(): UseBnbBalanceResult {
  const { address } = useAccount();

  // For native BNB, we need to use useBalance with BNB Chain
  const { data, isPending, isError } = useBalance({
    address,
    chainId: 56, // BNB Chain mainnet
  });

  const balanceWei = data?.value;
  const balanceFormatted = balanceWei
    ? Number(formatUnits(balanceWei, BNB_DECIMALS)).toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })
    : undefined;

  return {
    balanceWei,
    balanceFormatted,
    isLoading: isPending,
    isError: isError || false,
    address,
  };
}
