import { BOOST_CONFIG } from "@/lib/tokens";

export type BoostCalculationResult = {
  boostCoefficient: number;
  hasBnbBoost: boolean;
  hasAsterBoost: boolean;
  hasKiltBoost: boolean;
  hasBnbTokens: boolean;
  hasAsterTokens: boolean;
  hasKiltTokens: boolean;
  bnbBalance: bigint;
  asterBalance: bigint;
  kiltBalance: bigint;
};

export function calculateBoostCoefficient(
  bnbBalance: bigint,
  asterBalance: bigint,
  kiltBalance: bigint
): BoostCalculationResult {
  const hasBnbTokens = bnbBalance > 0;
  const hasAsterTokens = asterBalance > 0;
  const hasKiltTokens = kiltBalance > 0;
  
  const hasBnbBoost = bnbBalance >= BOOST_CONFIG.MIN_BNB_AMOUNT;
  const hasAsterBoost = asterBalance >= BOOST_CONFIG.MIN_ASTER_AMOUNT;
  const hasKiltBoost = kiltBalance > 0; // Any KILT balance gives boost

  let boostCoefficient = 1.0;

  // Choose the highest boost from available tokens
  const boosts = [];
  if (hasBnbBoost) boosts.push(BOOST_CONFIG.BNB_BOOST_COEFFICIENT);
  if (hasAsterBoost) boosts.push(BOOST_CONFIG.ASTER_BOOST_COEFFICIENT);
  if (hasKiltBoost) boosts.push(1.1); // 10% boost for KILT

  if (boosts.length > 0) {
    boostCoefficient = Math.max(...boosts);
  }

  // Ensure boost doesn't exceed maximum
  boostCoefficient = Math.min(boostCoefficient, BOOST_CONFIG.MAX_BOOST_COEFFICIENT);

  return {
    boostCoefficient,
    hasBnbBoost,
    hasAsterBoost,
    hasKiltBoost,
    hasBnbTokens,
    hasAsterTokens,
    hasKiltTokens,
    bnbBalance,
    asterBalance,
    kiltBalance,
  };
}

export function formatBoostPercentage(coefficient: number): string {
  const percentage = ((coefficient - 1) * 100).toFixed(0);
  return `${percentage}%`;
}

export function getBoostDescription(coefficient: number): string {
  if (coefficient === 1.0) {
    return "No boost";
  }
  
  const percentage = formatBoostPercentage(coefficient);
  return `${percentage} boost`;
}
