import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import {
  exchangeCodeForToken,
  getTwitterUser,
  updateTwitterProgress,
  checkFollowEnhanced,
  getTwitterUsernameById,
  TwitterTokenResponse,
  TwitterUserResponse,
} from "@/services/twitterService";

const STATE_SECRET = process.env.STATE_SECRET || "default-secret";

type CallbackStatePayload = {
  uuid: string;
  address: string;
  codeVerifier: string;
  returnUrl?: string;
  recheck?: boolean;
  timestamp?: number;
};

function verifyState(state: string): CallbackStatePayload {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const { payload, sig } = JSON.parse(decoded) as { payload: CallbackStatePayload; sig: string };
    const expected = createHmac("sha256", STATE_SECRET)
      .update(JSON.stringify(payload))
      .digest("hex");
    if (sig !== expected) throw new Error("Invalid state signature");
    return payload;
  } catch (err: unknown) {
    throw new Error("Invalid state: " + (err instanceof Error ? err.message : String(err)));
  }
}

function buildRedirectUrl(
  baseUrl: string,
  returnUrl: string,
  params: Record<string, string>
): string {
  const redirectUrl = new URL(returnUrl, baseUrl);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      redirectUrl.searchParams.set(key, value);
    }
  });
  
  return redirectUrl.toString();
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  
  // Handle OAuth errors
  if (error) {
    const errorDescription = req.nextUrl.searchParams.get("error_description");
    console.error('❌ Twitter OAuth error:', error, errorDescription);
    
    const redirectUrl = buildRedirectUrl(baseUrl, "/dashboard", {
      twitter_result: "error",
      toast_message: errorDescription || error
    });
    
    return Response.redirect(redirectUrl);
  }
  
  if (!code || !state) {
    console.error('❌ Missing code or state in callback');
    
    const redirectUrl = buildRedirectUrl(baseUrl, "/dashboard", {
      twitter_result: "error",
      toast_message: "Missing authorization code or state"
    });
    
    return Response.redirect(redirectUrl);
  }

  let payload: CallbackStatePayload;
  try {
    payload = verifyState(state);
  } catch (e: unknown) {
    console.error('❌ State verification failed:', e);
    
    const redirectUrl = buildRedirectUrl(baseUrl, "/dashboard", {
      twitter_result: "error",
      toast_message: "Invalid state parameter"
    });
    
    return Response.redirect(redirectUrl);
  }

  const { address, codeVerifier, returnUrl = "/dashboard", recheck = false } = payload;

  try {
    // STEP 1: Exchange code for token
    console.log('🔄 Step 1: Exchanging code for token...');
    let tokenResp: TwitterTokenResponse;
    
    try {
      tokenResp = await exchangeCodeForToken(code, codeVerifier);
      
      if (!tokenResp.access_token) {
        throw new Error("No access token received");
      }
      
      console.log('✅ Token exchange successful');
      
    } catch (tokenError) {
      console.error('❌ Token exchange failed:', tokenError);
      throw new Error(`Failed to exchange code for token: ${tokenError instanceof Error ? tokenError.message : String(tokenError)}`);
    }

    // STEP 2: Get authenticated user's Twitter info
    console.log('🔄 Step 2: Getting Twitter user info...');
    let userResp: TwitterUserResponse;
    
    try {
      userResp = await getTwitterUser(tokenResp.access_token);
      
      if (!userResp.data?.username || !userResp.data?.id) {
        throw new Error("Missing username or user ID in API response");
      }
      
      console.log('✅ User info retrieved successfully');
      
    } catch (userError) {
      console.error('❌ Failed to fetch Twitter user:', userError);
      throw new Error("Failed to fetch Twitter user information");
    }
    
    const twitterUsername = userResp.data.username;
    const twitterUserId = userResp.data.id;

    console.log(`✅ Authenticated: @${twitterUsername} (${twitterUserId})`);

    // STEP 3: Get target account information
    const TARGET_TWITTER_ID = process.env.TARGET_TWITTER_ID;
    const TARGET_TWITTER_USERNAME = process.env.TARGET_TWITTER_USERNAME;
    
    if (!TARGET_TWITTER_ID) {
      console.error('❌ TARGET_TWITTER_ID not configured');
      throw new Error("Server configuration error: TARGET_TWITTER_ID not set");
    }
    
    let targetUsername: string | undefined = TARGET_TWITTER_USERNAME;
    
    if (!targetUsername) {
      try {
        const fetchedUsername = await getTwitterUsernameById(tokenResp.access_token, TARGET_TWITTER_ID);
        targetUsername = fetchedUsername || undefined;
      } catch (targetError) {
        console.error('⚠️ Failed to fetch target username:', targetError);
      }
    }

    console.log(`🎯 Target account: @${targetUsername || 'Unknown'} (${TARGET_TWITTER_ID})`);

    // STEP 4: Check for self-follow
    const isSelfFollow = twitterUserId === TARGET_TWITTER_ID;
    
    if (isSelfFollow) {
      console.log(`⚠️ SELF-FOLLOW: User @${twitterUsername} is the target account`);
      
      // Update to state 2 (connected but not following) and enable Telegram
      await updateTwitterProgress(address, twitterUsername, twitterUserId, false);
      
      const redirectUrl = buildRedirectUrl(baseUrl, returnUrl, {
        twitter_result: "self_follow",
        username: twitterUsername,
        target_username: targetUsername || "",
        toast_message: `Connected as @${twitterUsername}. This is the target account - Telegram unlocked!`
      });
      
      return Response.redirect(redirectUrl);
    }

    // STEP 5: Check if user is following the target
    console.log(`🔄 Step 5: Checking if @${twitterUsername} follows @${targetUsername || TARGET_TWITTER_ID}...`);
    let isFollowing = false;
    
    try {
      const followResult = await checkFollowEnhanced(
        tokenResp.access_token, 
        twitterUserId, 
        TARGET_TWITTER_ID,
        targetUsername || undefined
      );
      
      isFollowing = followResult.isFollowing;
      
      console.log('📊 Follow check result:', { isFollowing });
      
    } catch (followError) {
      console.error('❌ Follow check failed:', followError);
      // If check fails, assume not following
      isFollowing = false;
    }

    // STEP 6: Update database based on follow status
    await updateTwitterProgress(address, twitterUsername, twitterUserId, isFollowing);
    
    console.log(`💾 Database updated: following=${isFollowing}`);

    // STEP 7: Redirect based on follow status
    
    if (isFollowing) {
      // User IS following - show success and enable Telegram
      console.log(`✅ SUCCESS: @${twitterUsername} is following @${targetUsername}`);
      
      const redirectUrl = buildRedirectUrl(baseUrl, returnUrl, {
        twitter_result: "following",
        username: twitterUsername,
        target_username: targetUsername || "",
        toast_message: `✅ Following @${targetUsername} - Telegram unlocked!`
      });
      
      return Response.redirect(redirectUrl);
    } else {
      // User is NOT following - show modal to follow
      console.log(`❌ NOT FOLLOWING: @${twitterUsername} needs to follow @${targetUsername}`);
      
      const redirectUrl = buildRedirectUrl(baseUrl, returnUrl, {
        twitter_result: recheck ? "still_not_following" : "not_following",
        username: twitterUsername,
        target_username: targetUsername || "",
        profile_url: `https://twitter.com/${targetUsername}`,
        toast_message: recheck 
          ? `Still not following @${targetUsername}. Please follow to continue.`
          : `Connected as @${twitterUsername}. Follow @${targetUsername} to unlock Telegram.`
      });
      
      return Response.redirect(redirectUrl);
    }

  } catch (err: unknown) {
    console.error('❌ CRITICAL ERROR in Twitter callback:', err);

    let errorMessage = "An error occurred during Twitter authentication";
    
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    
    const redirectUrl = buildRedirectUrl(baseUrl, returnUrl || "/dashboard", {
      twitter_result: "error",
      toast_message: errorMessage
    });

    return Response.redirect(redirectUrl);
  }
}