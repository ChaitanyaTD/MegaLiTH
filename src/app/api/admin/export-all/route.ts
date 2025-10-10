import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

    // Fetch ALL data from the database
    const [
      allUsers,
      allUserProgress,
      allUserBoosts,
      allReferrals,
      allAdmins
    ] = await Promise.all([
      // All users
      prisma.user.findMany({
        include: {
          progress: true,
          boost: true,
          referrals: {
            include: {
              referrer: {
                include: {
                  user: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }),

      // All user progress records
      prisma.userProgress.findMany({
        include: {
          user: true,
          referredUsers: {
            include: {
              user: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }),

      // All user boosts
      prisma.userBoost.findMany({
        include: {
          user: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }),

      // All referrals
      prisma.referral.findMany({
        include: {
          user: true,
          referrer: {
            include: {
              user: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }),

      // All admins
      prisma.admin.findMany({
        orderBy: {
          createdAt: "desc"
        }
      })
    ]);

    // Calculate comprehensive statistics
    const stats = {
      totalUsers: allUsers.length,
      totalUserProgress: allUserProgress.length,
      totalUserBoosts: allUserBoosts.length,
      totalReferrals: allReferrals.length,
      totalAdmins: allAdmins.length,
      usersWithReferralCodes: allUserProgress.filter(p => p.referralCode).length,
      usersWithTwitter: allUserProgress.filter(p => p.twitterId).length,
      usersWithTelegram: allUserProgress.filter(p => p.telegramId).length,
      usersWithBoosts: allUserBoosts.length,
      averageReferralsPerUser: allUserProgress.length > 0 
        ? (allReferrals.length / allUserProgress.length).toFixed(2) 
        : "0",
      exportTimestamp: new Date().toISOString()
    };

    // Helper function to convert BigInt values to strings for JSON serialization
    const serializeBigInt = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return obj.toString();
      if (obj instanceof Date) return obj.toISOString(); // Handle Date objects
      if (Array.isArray(obj)) return obj.map(serializeBigInt);
      if (typeof obj === 'object') {
        const serialized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          serialized[key] = serializeBigInt(value);
        }
        return serialized;
      }
      return obj;
    };

    return Response.json({
      success: true,
      data: {
        users: serializeBigInt(allUsers),
        userProgress: serializeBigInt(allUserProgress),
        userBoosts: serializeBigInt(allUserBoosts),
        referrals: serializeBigInt(allReferrals),
        admins: serializeBigInt(allAdmins)
      },
      stats,
      meta: {
        timestamp: new Date().toISOString(),
        recordCounts: {
          users: allUsers.length,
          userProgress: allUserProgress.length,
          userBoosts: allUserBoosts.length,
          referrals: allReferrals.length,
          admins: allAdmins.length
        }
      }
    });

  } catch (error: unknown) {
    console.error("Complete Database Export API Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to export database";
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
