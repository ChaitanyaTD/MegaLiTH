import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { erc20Abi } from "viem";
import { createPublicClient, http } from "viem";
import { bsc, base } from "viem/chains";
import { calculateBoostCoefficient } from "@/services/boostService";
import { ASTER_BNB_CHAIN_ADDRESS, KILT_BASE_TOKEN_ADDRESS } from "@/lib/tokens";

const bscClient = createPublicClient({ chain: bsc, transport: http() });
const baseClient = createPublicClient({ chain: base, transport: http() });

export async function GET(req: NextRequest) {
  try {
    // For Vercel cron jobs, check the authorization header
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get limit from query params for GET requests
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");

    const users = await prisma.user.findMany({
      select: { id: true, address: true },
      take: Math.min(Number(limit) || 100, 500),
      orderBy: { id: "asc" },
    });

    const results: Array<{ address: string; ok: boolean; error?: string }> = [];

    for (const u of users) {
      try {
        const [bnb, aster, kilt] = await Promise.all([
          bscClient.getBalance({ address: u.address as `0x${string}` }),
          bscClient.readContract({
            address: ASTER_BNB_CHAIN_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [u.address as `0x${string}`],
          }),
          baseClient.readContract({
            address: KILT_BASE_TOKEN_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [u.address as `0x${string}`],
          }),
        ]);

        const bnbWei = typeof bnb === "bigint" ? bnb : BigInt(bnb as bigint);
        const asterWei = typeof aster === "bigint" ? aster : BigInt(aster as bigint);
        const kiltWei = typeof kilt === "bigint" ? kilt : BigInt(kilt as bigint);

        const res = calculateBoostCoefficient(bnbWei, asterWei, kiltWei);

        await prisma.userBoost.upsert({
          where: { userId: u.id },
          update: {
            bnbBalance: bnbWei.toString(),
            asterBalance: asterWei.toString(),
            kiltBalance: kiltWei.toString(),
            boostCoefficient: res.boostCoefficient,
            hasBnbBoost: res.hasBnbBoost,
            hasAsterBoost: res.hasAsterBoost,
            hasKiltBoost: res.hasKiltBoost,
            lastUpdated: new Date(),
          },
          create: {
            userId: u.id,
            bnbBalance: bnbWei.toString(),
            asterBalance: asterWei.toString(),
            kiltBalance: kiltWei.toString(),
            boostCoefficient: res.boostCoefficient,
            hasBnbBoost: res.hasBnbBoost,
            hasAsterBoost: res.hasAsterBoost,
            hasKiltBoost: res.hasKiltBoost,
          },
        });

        results.push({ address: u.address, ok: true });
      } catch (e) {
        results.push({ address: u.address, ok: false, error: (e as Error).message });
      }
    }

    return NextResponse.json({ success: true, processed: users.length, results });
  } catch (error) {
    return NextResponse.json({ error: "Failed", details: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { limit = 100 } = await req.json().catch(() => ({ limit: 100 }));

    const users = await prisma.user.findMany({
      select: { id: true, address: true },
      take: Math.min(Number(limit) || 100, 500),
      orderBy: { id: "asc" },
    });

    const results: Array<{ address: string; ok: boolean; error?: string }> = [];

    for (const u of users) {
      try {
        const [bnb, aster, kilt] = await Promise.all([
          bscClient.getBalance({ address: u.address as `0x${string}` }),
          bscClient.readContract({
            address: ASTER_BNB_CHAIN_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [u.address as `0x${string}`],
          }),
          baseClient.readContract({
            address: KILT_BASE_TOKEN_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [u.address as `0x${string}`],
          }),
        ]);

        const bnbWei = typeof bnb === "bigint" ? bnb : BigInt(bnb as bigint);
        const asterWei = typeof aster === "bigint" ? aster : BigInt(aster as bigint);
        const kiltWei = typeof kilt === "bigint" ? kilt : BigInt(kilt as bigint);

        const res = calculateBoostCoefficient(bnbWei, asterWei, kiltWei);

        await prisma.userBoost.upsert({
          where: { userId: u.id },
          update: {
            bnbBalance: bnbWei.toString(),
            asterBalance: asterWei.toString(),
            kiltBalance: kiltWei.toString(),
            boostCoefficient: res.boostCoefficient,
            hasBnbBoost: res.hasBnbBoost,
            hasAsterBoost: res.hasAsterBoost,
            hasKiltBoost: res.hasKiltBoost,
            lastUpdated: new Date(),
          },
          create: {
            userId: u.id,
            bnbBalance: bnbWei.toString(),
            asterBalance: asterWei.toString(),
            kiltBalance: kiltWei.toString(),
            boostCoefficient: res.boostCoefficient,
            hasBnbBoost: res.hasBnbBoost,
            hasAsterBoost: res.hasAsterBoost,
            hasKiltBoost: res.hasKiltBoost,
          },
        });

        results.push({ address: u.address, ok: true });
      } catch (e) {
        results.push({ address: u.address, ok: false, error: (e as Error).message });
      }
    }

    return NextResponse.json({ success: true, processed: users.length, results });
  } catch (error) {
    return NextResponse.json({ error: "Failed", details: (error as Error).message }, { status: 500 });
  }
}
