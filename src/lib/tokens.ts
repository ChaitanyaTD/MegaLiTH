export const KILT_BASE_TOKEN_ADDRESS = "0x5d0dd05bb095fdd6af4865a1adf97c39c85ad2d8" as const;
export const KILT_DECIMALS = 18 as const;

export const BNB_BNB_CHAIN_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
export const BNB_DECIMALS = 18 as const;

export const ASTER_BNB_CHAIN_ADDRESS = "0x000ae314e2a2172a039b26378814c252734f556a" as const;
export const ASTER_DECIMALS = 18 as const;

// Boost configuration
export const BOOST_CONFIG = {
  // Minimum token amounts required for boost (in wei)
  MIN_BNB_AMOUNT: BigInt("150000000000000000"),
  MIN_ASTER_AMOUNT: BigInt("10000000000000000000"),
  
  // Boost coefficients
  BNB_BOOST_COEFFICIENT: 1.2,
  ASTER_BOOST_COEFFICIENT: 1.5,
  
  MAX_BOOST_COEFFICIENT: 2.0,
} as const;


