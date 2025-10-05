import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkFollowEnhanced, refreshAccessToken } from "@/services/twitterService";

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { address },
      include: { progress: true }
    });

    if (!user || !user.progress) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const { twitterUserId, twitterId, twitterRefreshToken } = user.progress;

    if (!twitterUserId || !twitterId) {
      return NextResponse.json(
        { error: "Twitter authentication required", needsAuth: true },
        { status: 400 }
      );
    }

    // Get target account info
    const TARGET_TWITTER_ID = process.env.TARGET_TWITTER_ID;
    const TARGET_TWITTER_USERNAME = process.env.TARGET_TWITTER_USERNAME;

    if (!TARGET_TWITTER_ID) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Check if self-follow (user is the target)
    if (twitterUserId === TARGET_TWITTER_ID) {
      await prisma.userProgress.update({
        where: { userId: user.id },
        data: { xState: 3, tgState: 1 }
      });

      return NextResponse.json({
        success: true,
        isFollowing: true,
        selfAccount: true,
        message: "You are the target account owner"
      });
    }

    // Check if we have a refresh token
    if (!twitterRefreshToken) {
      return NextResponse.json({
        error: "No refresh token available",
        needsAuth: true,
        message: "Please re-authenticate to verify follow status"
      }, { status: 400 });
    }

    // Get fresh access token using refresh token
    let accessToken: string;
    let newRefreshToken: string | undefined;
    
    try {
      const tokenResponse = await refreshAccessToken(twitterRefreshToken);
      accessToken = tokenResponse.access_token;
      newRefreshToken = tokenResponse.refresh_token;

      // Update refresh token if a new one was provided
      if (newRefreshToken && newRefreshToken !== twitterRefreshToken) {
        await prisma.userProgress.update({
          where: { userId: user.id },
          data: { twitterRefreshToken: newRefreshToken }
        });
      }
    } catch (refreshError) {
      console.error("Failed to refresh token:", refreshError);
      return NextResponse.json({
        error: "Token refresh failed",
        needsAuth: true,
        message: "Please re-authenticate to verify follow status"
      }, { status: 401 });
    }

    // Check follow status with fresh token
    console.log(`Checking if @${twitterId} follows @${TARGET_TWITTER_USERNAME || TARGET_TWITTER_ID}...`);

    const followResult = await checkFollowEnhanced(
      accessToken,
      twitterUserId,
      TARGET_TWITTER_ID,
      TARGET_TWITTER_USERNAME || undefined
    );

    const isFollowing = followResult.isFollowing;

    // Update database based on follow status
    await prisma.userProgress.update({
      where: { userId: user.id },
      data: {
        xState: isFollowing ? 3 : 2,
        tgState: isFollowing ? 1 : 0
      }
    });

    console.log(`Follow check result for @${twitterId}: ${isFollowing}`);

    return NextResponse.json({
      success: true,
      isFollowing,
      username: twitterId,
      targetUsername: TARGET_TWITTER_USERNAME,
      message: isFollowing
        ? `✅ Following @${TARGET_TWITTER_USERNAME}! Telegram unlocked.`
        : `Still not following @${TARGET_TWITTER_USERNAME}. Please follow to continue.`
    });

  } catch (error) {
    console.error("Recheck error:", error);
    return NextResponse.json(
      { error: "Failed to check follow status", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}