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
  
  if (error) {
    const errorDescription = req.nextUrl.searchParams.get("error_description");
    console.error('❌ Twitter OAuth error:', error, errorDescription);
    
    const redirectUrl = buildRedirectUrl(baseUrl, "/dashboard", {
      twitter_result: "error",
      toast_type: "error",
      toast_message: errorDescription || error
    });
    
    return Response.redirect(redirectUrl);
  }
  
  if (!code || !state) {
    console.error('❌ Missing code or state in callback');
    
    const redirectUrl = buildRedirectUrl(baseUrl, "/dashboard", {
      twitter_result: "error",
      toast_type: "error",
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
      toast_type: "error",
      toast_message: "Invalid state parameter"
    });
    
    return Response.redirect(redirectUrl);
  }

  const { address, codeVerifier, returnUrl = "/dashboard", recheck = false } = payload;

  try {
    // ===== STEP 1: Exchange authorization code for access token =====
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

    // ===== STEP 2: Get authenticated user's Twitter info =====
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
      
      let errorMessage = "Failed to fetch Twitter user information";
      
      if (userError instanceof TypeError && userError.message.includes('fetch')) {
        errorMessage = "Network error: Unable to connect to Twitter API";
      } else if (userError instanceof Error) {
        if (userError.message.includes('401') || userError.message.includes('Unauthorized')) {
          errorMessage = "Twitter authorization failed. Please try again.";
        } else if (userError.message.includes('403') || userError.message.includes('Forbidden')) {
          errorMessage = "Twitter access forbidden. Check API permissions.";
        } else if (userError.message.includes('429')) {
          errorMessage = "Too many requests. Please wait and try again.";
        } else {
          errorMessage = userError.message;
        }
      }
      
      throw new Error(errorMessage);
    }
    
    const twitterUsername = userResp.data.username;
    const twitterUserId = userResp.data.id;

    console.log(`✅ Authenticated: @${twitterUsername} (${twitterUserId})`);

    // ===== STEP 3: Get target account information =====
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

    // ===== STEP 4: Check for self-follow FIRST =====
    const isSelfFollow = twitterUserId === TARGET_TWITTER_ID;
    
    if (isSelfFollow) {
      console.log(`⚠️ SELF-FOLLOW DETECTED: User @${twitterUsername} (${twitterUserId}) is the target account`);
      
      await updateTwitterProgress(
        address, 
        twitterUsername, 
        twitterUserId,
        false
      );
      
      console.log('💾 Database updated: xState=2, following=false (self-follow)');
      
      const redirectUrl = buildRedirectUrl(baseUrl, returnUrl, {
        twitter_result: "self_follow",
        is_following: "false",
        username: twitterUsername,
        toast_type: "error",
        toast_message: `You cannot follow your own account (@${twitterUsername}). Please connect with a different Twitter account.`
      });
      
      console.log('🔄 Redirecting with self_follow result');
      return Response.redirect(redirectUrl);
    }

    // ===== STEP 5: Check if user is following the target account =====
    console.log(`🔄 Step 5: Checking if @${twitterUsername} follows @${targetUsername || TARGET_TWITTER_ID}...`);
    let followResult;
    
    try {
      followResult = await checkFollowEnhanced(
        tokenResp.access_token, 
        twitterUserId, 
        TARGET_TWITTER_ID,
        targetUsername || undefined
      );
      
      console.log('📊 Follow check result:', {
        isFollowing: followResult.isFollowing,
        needsManualCheck: followResult.needsManualCheck,
        redirectToProfile: followResult.redirectToProfile,
        profileUrl: followResult.profileUrl
      });
      
    } catch (followError) {
      console.error('❌ Follow check failed:', followError);
      
      // CRITICAL FIX: If follow check fails, update to state 2 and show manual verification
      await updateTwitterProgress(
        address, 
        twitterUsername, 
        twitterUserId,
        false
      );
      
      console.log('⚠️ Follow check failed, falling back to manual verification');
      
      const redirectUrl = buildRedirectUrl(baseUrl, returnUrl, {
        twitter_result: "manual_check",
        is_following: "false",
        username: twitterUsername,
        target_username: targetUsername || "",
        profile_url: targetUsername ? `https://twitter.com/${targetUsername}` : "",
        toast_type: "warning",
        toast_message: `Connected as @${twitterUsername}. Please manually verify you're following @${targetUsername}.`
      });
      
      return Response.redirect(redirectUrl);
    }

    // ===== STEP 6: Update database IMMEDIATELY based on follow status =====
    const finalState = followResult.isFollowing ? 3 : 2;
    
    try {
      await updateTwitterProgress(
        address, 
        twitterUsername, 
        twitterUserId,
        followResult.isFollowing
      );
      
      console.log(`💾 Database updated: xState=${finalState}, following=${followResult.isFollowing}`);
      
    } catch (dbError) {
      console.error('⚠️ Database update failed (continuing anyway):', dbError);
    }

    // ===== STEP 7: Build redirect URL based on follow status =====
    
    // CASE 1: Successfully following ✅
    if (followResult.isFollowing) {
      console.log(`✅ SUCCESS: @${twitterUsername} is following @${targetUsername}`);
      
      const redirectUrl = buildRedirectUrl(baseUrl, returnUrl, {
        twitter_result: recheck ? "recheck_success" : "success",
        is_following: "true",
        username: twitterUsername,
        target_username: targetUsername || "",
        toast_type: "success",
        toast_message: `✅ Successfully verified! You are following @${targetUsername}.`
      });
      
      return Response.redirect(redirectUrl);
    }
    
    // CASE 2: Manual verification needed ⚠️
    if (followResult.needsManualCheck) {
      console.log(`⚠️ MANUAL CHECK: Automatic verification unavailable for @${twitterUsername}`);
      
      const redirectUrl = buildRedirectUrl(baseUrl, returnUrl, {
        twitter_result: "manual_check",
        is_following: "false",
        username: twitterUsername,
        target_username: targetUsername || "",
        profile_url: followResult.profileUrl || "",
        toast_type: "warning",
        toast_message: `Connected as @${twitterUsername}. Please verify you're following @${targetUsername}.`
      });
      
      return Response.redirect(redirectUrl);
    }
    
    // CASE 3: Not following - needs to follow ❌
    if (followResult.redirectToProfile) {
      console.log(`❌ NOT FOLLOWING: @${twitterUsername} needs to follow @${targetUsername}`);
      
      const redirectUrl = buildRedirectUrl(baseUrl, returnUrl, {
        twitter_result: recheck ? "still_not_following" : "not_following",
        is_following: "false",
        username: twitterUsername,
        target_username: targetUsername || "",
        profile_url: followResult.profileUrl || "",
        needs_follow: "true",
        toast_type: recheck ? "error" : "info",
        toast_message: recheck 
          ? `❌ Still not following @${targetUsername}. Please follow and try again.`
          : `Connected as @${twitterUsername}. Please follow @${targetUsername} to continue.`
      });
      
      return Response.redirect(redirectUrl);
    }
    
    // CASE 4: Default - authenticated but status unclear ℹ️
    console.log(`ℹ️ AUTHENTICATED: @${twitterUsername} connected, status unclear`);
    
    const redirectUrl = buildRedirectUrl(baseUrl, returnUrl, {
      twitter_result: "authenticated",
      is_following: "false",
      username: twitterUsername,
      target_username: targetUsername || "",
      toast_type: "info",
      toast_message: `Connected as @${twitterUsername}. Please complete follow verification.`
    });
    
    return Response.redirect(redirectUrl);

  } catch (err: unknown) {
    console.error('❌ CRITICAL ERROR in Twitter callback:', err);
    
    if (err instanceof Error) {
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    }

    let errorMessage = "An error occurred during Twitter authentication";
    
    if (err instanceof Error) {
      if (err.message.includes('Network') || err.message.includes('fetch')) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (err.message.includes('token') || err.message.includes('authorization')) {
        errorMessage = "Authentication failed. Please try connecting again.";
      } else if (err.message.includes('user') || err.message.includes('Twitter user')) {
        errorMessage = "Failed to retrieve Twitter account info. Please try again.";
      } else if (err.message.includes('configuration') || err.message.includes('TARGET_TWITTER_ID')) {
        errorMessage = "Server configuration error. Please contact support.";
      } else {
        errorMessage = err.message;
      }
    }
    
    const redirectUrl = buildRedirectUrl(baseUrl, returnUrl || "/dashboard", {
      twitter_result: "error",
      toast_type: "error",
      toast_message: errorMessage
    });

    return Response.redirect(redirectUrl);
  }
}