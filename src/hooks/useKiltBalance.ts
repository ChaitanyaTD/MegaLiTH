"use client";

import { erc20Abi, formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { KILT_BASE_TOKEN_ADDRESS, KILT_DECIMALS } from "@/lib/tokens";

export type UseKiltBalanceResult = {
  balanceWei?: bigint;
  balanceFormatted?: string;
  isLoading: boolean;
  isError: boolean;
  address?: `0x${string}`;
};

export function useKiltBalance(): UseKiltBalanceResult {
  const { address } = useAccount();

  const { data, isPending, isError } = useReadContract({
    address: KILT_BASE_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const balanceWei = typeof data === "bigint" ? (data as bigint) : undefined;
  const balanceFormatted = balanceWei
    ? Number(formatUnits(balanceWei, KILT_DECIMALS)).toLocaleString(undefined, {
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


