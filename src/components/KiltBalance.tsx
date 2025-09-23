"use client";

import { useKiltBalance } from "@/hooks/useKiltBalance";

export default function KiltBalance({ className }: { className?: string }) {
  const { address, balanceFormatted, isLoading, isError } = useKiltBalance();
  const display = !address
    ? "Connect wallet"
    : isLoading
    ? "Loading..."
    : isError
    ? "-"
    : balanceFormatted ?? "-";

  return <span className={className}>{display}</span>;
}


