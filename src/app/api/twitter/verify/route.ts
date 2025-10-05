import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkFollowEnhanced, refreshAccessToken } from "@/services/twitterService";

/**
 * CRON JOB ENDPOINT - Verify pending Twitter follows
 * 
 * Setup in Vercel/your platform:
 * - Schedule: Every 5-10 minutes
 * - URL: /api/twitter/verify
 * - Method: POST
 * - Authorization: Add CRON_SECRET header for security
 */

export async function POST(req: NextRequest) {
  try {
    // Security: Verify cron secret
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("=== Starting Twitter Follow Verification Cron ===");

    const TARGET_TWITTER_ID = process.env.TARGET_TWITTER_ID;
    const TARGET_TWITTER_USERNAME = process.env.TARGET_TWITTER_USERNAME;

    if (!TARGET_TWITTER_ID) {
      return NextResponse.json(
        { error: "TARGET_TWITTER_ID not configured" },
        { status: 500 }
      );
    }

    // Find all users with pending verification (xState = 3, xVerified = false)
    const pendingUsers = await prisma.userProgress.findMany({
      where: {
        xState: 3,
        xVerified: false,
        twitterRefreshToken: { not: null },
      },
      include: { user: true },
      take: 50, // Process 50 users per run to avoid timeouts
    });

    console.log(`Found ${pendingUsers.length} users pending verification`);

    const results = {
      total: pendingUsers.length,
      verified: 0,
      notFollowing: 0,
      errors: 0,
    };

    for (const userProgress of pendingUsers) {
      const { twitterUserId, twitterId, twitterRefreshToken, userId } = userProgress;

      try {
        // Skip if missing required data
        if (!twitterUserId || !twitterId || !twitterRefreshToken) {
          console.log(`Skipping user ${userId} - missing data`);
          results.errors++;
          continue;
        }

        console.log(`Checking @${twitterId} (${twitterUserId})...`);

        // Skip if self-follow (should already be verified, but safety check)
        if (twitterUserId === TARGET_TWITTER_ID) {
          await prisma.userProgress.update({
            where: { userId },
            data: { xVerified: true },
          });
          results.verified++;
          continue;
        }

        if (!twitterRefreshToken) {
          console.log(`No refresh token for @${twitterId}, skipping`);
          results.errors++;
          continue;
        }

        // Get fresh access token
        let accessToken: string;
        let newRefreshToken: string | undefined;

        try {
          const tokenResponse = await refreshAccessToken(twitterRefreshToken);
          accessToken = tokenResponse.access_token;
          newRefreshToken = tokenResponse.refresh_token;

          // Update refresh token if new one provided
          if (newRefreshToken && newRefreshToken !== twitterRefreshToken) {
            await prisma.userProgress.update({
              where: { userId },
              data: { twitterRefreshToken: newRefreshToken },
            });
          }
        } catch (refreshError) {
          console.error(`Failed to refresh token for @${twitterId}:`, refreshError);
          
          // Mark as needing re-authentication
          await prisma.userProgress.update({
            where: { userId },
            data: { 
              xState: 2, // Back to "authenticated but not verified"
              tgState: 0, // Lock Telegram again
            },
          });
          
          results.errors++;
          continue;
        }

        // Check follow status
        const followResult = await checkFollowEnhanced(
          accessToken,
          twitterUserId,
          TARGET_TWITTER_ID,
          TARGET_TWITTER_USERNAME || undefined
        );

        if (followResult.isFollowing) {
          // VERIFIED - User is following!
          await prisma.userProgress.update({
            where: { userId },
            data: {
              xVerified: true,
              xState: 3,
              tgState: 1, // Ensure Telegram is unlocked
            },
          });

          console.log(`✅ @${twitterId} verified as following`);
          results.verified++;
        } else {
          // NOT FOLLOWING - Revoke access
          await prisma.userProgress.update({
            where: { userId },
            data: {
              xState: 2, // Back to "authenticated but not verified"
              xVerified: false,
              tgState: 0, // Lock Telegram
            },
          });

          console.log(`❌ @${twitterId} is not following - access revoked`);
          results.notFollowing++;
        }

        // Rate limiting: Small delay between checks
        await new Promise((resolve) => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error checking @${twitterId}:`, error);
        results.errors++;
      }
    }

    console.log("=== Verification Cron Complete ===");
    console.log("Results:", results);

    return NextResponse.json({
      success: true,
      message: "Verification complete",
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        error: "Cron job failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Optional: Allow GET for manual trigger (with same auth)
export async function GET(req: NextRequest) {
  return POST(req);
}