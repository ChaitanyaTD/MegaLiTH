import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

async function isAdmin(address: string): Promise<boolean> {
  const admin = await prisma.admin.findUnique({
    where: { address: address.toLowerCase() },
  });
  return !!admin;
}

export async function GET(req: NextRequest) {
  try {
    const address = req.headers.get("x-wallet-address");

    if (!address) {
      return new Response(JSON.stringify({ error: "Wallet address required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const hasAccess = await isAdmin(address);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Unauthorized access" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch all users with referral codes and their referred users
    const referrals = await prisma.userProgress.findMany({
      where: {
        referralCode: { not: null },
      },
      include: {
        user: {
          select: {
            address: true,
            createdAt: true,
          },
        },
        referredUsers: {
          include: {
            user: {
              select: {
                address: true,
                createdAt: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Get total unique users count (including those without referral codes)
    const totalUsersCount = await prisma.user.count();

    // Calculate overall statistics
    const totalReferralsCount = await prisma.referral.count();

    // Format data for frontend
    const formattedData = referrals.map((ref) => ({
      address: ref.user.address,
      referralCode: ref.referralCode,
      totalReferrals: ref.referredUsers.length,
      createdAt: ref.user.createdAt,
      updatedAt: ref.updatedAt,
      referredUsers: ref.referredUsers.map((r) => ({
        address: r.user.address,
        joinedAt: r.user.createdAt,
        referralId: r.id,
      })),
    }));

    // Sort by total referrals (descending)
    formattedData.sort((a, b) => b.totalReferrals - a.totalReferrals);

    return Response.json({
      success: true,
      data: formattedData,
      stats: {
        totalUsers: totalUsersCount,
        totalReferrers: formattedData.length,
        totalReferrals: totalReferralsCount,
        averageReferralsPerUser:
          formattedData.length > 0
            ? (totalReferralsCount / formattedData.length).toFixed(2)
            : 0,
      },
      meta: {
        timestamp: new Date().toISOString(),
        recordCount: formattedData.length,
      },
    });
  } catch (error: unknown) {
    console.error("Admin Dashboard API Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch referrals";
    return new Response(
      JSON.stringify({
        error: message,
        success: false,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}