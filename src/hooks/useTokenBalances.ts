"use client";

import { useKiltBalance } from "./useKiltBalance";
import { useBnbBalance } from "./useBnbBalance";
import { useAsterBalance } from "./useAsterBalance";

export type TokenBalances = {
  kilt: ReturnType<typeof useKiltBalance>;
  bnb: ReturnType<typeof useBnbBalance>;
  aster: ReturnType<typeof useAsterBalance>;
};

export function useTokenBalances(): TokenBalances {
  const kilt = useKiltBalance();
  const bnb = useBnbBalance();
  const aster = useAsterBalance();

  return {
    kilt,
    bnb,
    aster,
  };
}
