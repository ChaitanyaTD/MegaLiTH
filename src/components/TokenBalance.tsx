"use client";

import { useTokenBalances } from "@/hooks/useTokenBalances";

type TokenType = "bnb" | "aster";

interface TokenBalanceProps {
  token: TokenType;
  className?: string;
}

export default function TokenBalance({ token, className }: TokenBalanceProps) {
  const { bnb, aster } = useTokenBalances();
  const tokenData = token === "bnb" ? bnb : aster;
  const tokenName = token.toUpperCase();

  if (tokenData.isLoading) {
    return (
      <div className={`w-full card rounded-md p-3 font-mono ${className}`}>
        <div className="animate-pulse">Loading {tokenName}...</div>
      </div>
    );
  }

  if (tokenData.isError) {
    return (
      <div className={`w-full card rounded-md p-3 font-mono ${className}`}>
        <div className="text-red-500">Error loading {tokenName}</div>
      </div>
    );
  }

  return (
    <div className={`w-full card rounded-md p-3 font-mono ${className}`}>
      {tokenData.balanceFormatted || "0.00"}
    </div>
  );
}
