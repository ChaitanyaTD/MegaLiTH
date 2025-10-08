"use client";

import { erc20Abi, formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ASTER_BNB_CHAIN_ADDRESS, ASTER_DECIMALS } from "@/lib/tokens";

export type UseAsterBalanceResult = {
  balanceWei?: bigint;
  balanceFormatted?: string;
  isLoading: boolean;
  isError: boolean;
  address?: `0x${string}`;
};

export function useAsterBalance(): UseAsterBalanceResult {
  const { address } = useAccount();

  const { data, isPending, isError } = useReadContract({
    address: ASTER_BNB_CHAIN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: 56, // BNB Chain mainnet
    query: { enabled: Boolean(address) },
  });

  const balanceWei = typeof data === "bigint" ? (data as bigint) : undefined;
  const balanceFormatted = balanceWei
    ? Number(formatUnits(balanceWei, ASTER_DECIMALS)).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })
    : undefined;

  return {
    balanceWei,
    balanceFormatted,
    isLoading: isPending,
    isError,
    address,
  };
}
