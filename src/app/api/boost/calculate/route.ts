import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateBoostCoefficient } from "@/services/boostService";
import { erc20Abi } from "viem";
import { createPublicClient, http, formatUnits } from "viem";
import { bsc, base } from "viem/chains";
import { BNB_DECIMALS, ASTER_BNB_CHAIN_ADDRESS, ASTER_DECIMALS, KILT_BASE_TOKEN_ADDRESS, KILT_DECIMALS } from "@/lib/tokens";

// Create public clients for different chains
const bscClient = createPublicClient({
  chain: bsc,
  transport: http(),
});

const baseClient = createPublicClient({
  chain: base,
  transport: http(),
});

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // Find user by address
    const user = await prisma.user.findUnique({
      where: { address },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get token balances from blockchain
    const [bnbBalance, asterBalance, kiltBalance] = await Promise.all([
      // For native BNB, use getBalance on BNB Chain
      bscClient.getBalance({
        address: address as `0x${string}`,
      }),
      // ASTER token on BNB Chain
      bscClient.readContract({
        address: ASTER_BNB_CHAIN_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      }),
      // KILT token on Base Chain
      baseClient.readContract({
        address: KILT_BASE_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      }),
    ]);

    const bnbBalanceWei = typeof bnbBalance === 'bigint' ? bnbBalance : BigInt(bnbBalance);
    const asterBalanceWei = typeof asterBalance === 'bigint' ? asterBalance : BigInt(asterBalance);
    const kiltBalanceWei = typeof kiltBalance === 'bigint' ? kiltBalance : BigInt(kiltBalance);

    // Calculate boost coefficient
    const boostResult = calculateBoostCoefficient(bnbBalanceWei, asterBalanceWei, kiltBalanceWei);
    
    // Upsert user boost data with string values
    const userBoost = await prisma.userBoost.upsert({
      where: { userId: user.id },
      update: {
        bnbBalance: bnbBalanceWei.toString(),
        asterBalance: asterBalanceWei.toString(),
        kiltBalance: kiltBalanceWei.toString(),
        boostCoefficient: boostResult.boostCoefficient,
        hasBnbBoost: boostResult.hasBnbBoost,
        hasAsterBoost: boostResult.hasAsterBoost,
        hasKiltBoost: boostResult.hasKiltBoost,
        lastUpdated: new Date(),
      },
      create: {
        userId: user.id,
        bnbBalance: bnbBalanceWei.toString(),
        asterBalance: asterBalanceWei.toString(),
        kiltBalance: kiltBalanceWei.toString(),
        boostCoefficient: boostResult.boostCoefficient,
        hasBnbBoost: boostResult.hasBnbBoost,
        hasAsterBoost: boostResult.hasAsterBoost,
        hasKiltBoost: boostResult.hasKiltBoost,
      },
    });

    // Format balances for response
    const bnbBalanceFormatted = Number(formatUnits(bnbBalanceWei, BNB_DECIMALS));
    const asterBalanceFormatted = Number(formatUnits(asterBalanceWei, ASTER_DECIMALS));
    const kiltBalanceFormatted = Number(formatUnits(kiltBalanceWei, KILT_DECIMALS));

    return NextResponse.json({
      success: true,
      data: {
        boostCoefficient: boostResult.boostCoefficient,
        hasBnbBoost: boostResult.hasBnbBoost,
        hasAsterBoost: boostResult.hasAsterBoost,
        hasKiltBoost: boostResult.hasKiltBoost,
        hasBnbTokens: boostResult.hasBnbTokens,
        hasAsterTokens: boostResult.hasAsterTokens,
        hasKiltTokens: boostResult.hasKiltTokens,
        balances: {
          bnb: {
            wei: bnbBalanceWei.toString(),
            formatted: bnbBalanceFormatted,
          },
          aster: {
            wei: asterBalanceWei.toString(),
            formatted: asterBalanceFormatted,
          },
          kilt: {
            wei: kiltBalanceWei.toString(),
            formatted: kiltBalanceFormatted,
          },
        },
        lastUpdated: userBoost.lastUpdated,
      },
    });
  } catch (error) {
    console.error("Error calculating boost:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to calculate boost", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // Find user by address
    const user = await prisma.user.findUnique({
      where: { address },
      include: { boost: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.boost) {
      return NextResponse.json({
        success: true,
        data: {
          boostCoefficient: 1.0,
          hasBnbBoost: false,
          hasAsterBoost: false,
          hasKiltBoost: false,
          hasBnbTokens: false,
          hasAsterTokens: false,
          hasKiltTokens: false,
          balances: {
            bnb: { wei: "0", formatted: 0 },
            aster: { wei: "0", formatted: 0 },
            kilt: { wei: "0", formatted: 0 },
          },
          lastUpdated: null,
        },
      });
    }

    // Format balances for response with null checks
    const bnbBalance = BigInt(user.boost.bnbBalance || "0");
    const asterBalance = BigInt(user.boost.asterBalance || "0");
    const kiltBalance = BigInt(user.boost.kiltBalance || "0");
    
    const bnbBalanceFormatted = Number(formatUnits(bnbBalance, BNB_DECIMALS));
    const asterBalanceFormatted = Number(formatUnits(asterBalance, ASTER_DECIMALS));
    const kiltBalanceFormatted = Number(formatUnits(kiltBalance, KILT_DECIMALS));

    return NextResponse.json({
      success: true,
      data: {
        boostCoefficient: user.boost.boostCoefficient || 1.0,
        hasBnbBoost: user.boost.hasBnbBoost || false,
        hasAsterBoost: user.boost.hasAsterBoost || false,
        hasKiltBoost: user.boost.hasKiltBoost || false,
        hasBnbTokens: bnbBalance > 0,
        hasAsterTokens: asterBalance > 0,
        hasKiltTokens: kiltBalance > 0,
        balances: {
          bnb: {
            wei: bnbBalance.toString(),
            formatted: bnbBalanceFormatted,
          },
          aster: {
            wei: asterBalance.toString(),
            formatted: asterBalanceFormatted,
          },
          kilt: {
            wei: kiltBalance.toString(),
            formatted: kiltBalanceFormatted,
          },
        },
        lastUpdated: user.boost.lastUpdated,
      },
    });
  } catch (error) {
    console.error("Error fetching boost:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to fetch boost", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
