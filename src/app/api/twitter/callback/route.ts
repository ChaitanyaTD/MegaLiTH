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

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  
  const baseUrl = process.env.NEXTAUTH_URL;
  
  // ===== FLOW: Handle OAuth errors =====
  if (error) {
    const errorDescription = req.nextUrl.searchParams.get("error_description");
    console.error('Twitter OAuth error:', error, errorDescription);
    
    const redirectUrl = new URL("/dashboard", baseUrl);
    redirectUrl.searchParams.set("twitter_result", "error");
    redirectUrl.searchParams.set("toast_type", "error");
    redirectUrl.searchParams.set("toast_message", errorDescription || error);
    
    return Response.redirect(redirectUrl.toString());
  }
  
  // ===== FLOW: Validate required parameters =====
  if (!code || !state) {
    console.error('Missing code or state in callback');
    const redirectUrl = new URL("/dashboard", baseUrl);
    redirectUrl.searchParams.set("twitter_result", "error");
    redirectUrl.searchParams.set("toast_type", "error");
    redirectUrl.searchParams.set("toast_message", "Missing authorization code or state");
    return Response.redirect(redirectUrl.toString());
  }

  // ===== FLOW: Verify state signature =====
  let payload: CallbackStatePayload;
  try {
    payload = verifyState(state);
  } catch (e: unknown) {
    console.error('State verification failed:', e);
    const redirectUrl = new URL("/dashboard", baseUrl);
    redirectUrl.searchParams.set("twitter_result", "error");
    redirectUrl.searchParams.set("toast_type", "error");
    redirectUrl.searchParams.set("toast_message", "Invalid state parameter");
    return Response.redirect(redirectUrl.toString());
  }

  const { address, codeVerifier, returnUrl = "/dashboard", recheck = false } = payload;

  try {
    // ===== FLOW STEP 1: Exchange authorization code for access token =====
    console.log('🔄 Step 1: Exchanging code for token...');
    const tokenResp: TwitterTokenResponse = await exchangeCodeForToken(code, codeVerifier);

    // ===== FLOW STEP 2: Get authenticated user's Twitter info =====
    console.log('🔄 Step 2: Getting Twitter user info...');
    const userResp: TwitterUserResponse = await getTwitterUser(tokenResp.access_token);
    const twitterUsername = userResp.data?.username;
    const twitterUserId = userResp.data?.id;

    if (!twitterUsername || !twitterUserId) {
      throw new Error("Failed to get Twitter user information");
    }

    console.log(`✅ Authenticated: @${twitterUsername} (${twitterUserId})`);

    // ===== FLOW STEP 3: Get target account information =====
    const TARGET_TWITTER_ID = process.env.TARGET_TWITTER_ID!;
    const TARGET_TWITTER_USERNAME = process.env.TARGET_TWITTER_USERNAME;
    
    let targetUsername: string | undefined = TARGET_TWITTER_USERNAME;
    if (!targetUsername) {
      const fetchedUsername = await getTwitterUsernameById(tokenResp.access_token, TARGET_TWITTER_ID);
      targetUsername = fetchedUsername || undefined;
    }

    console.log(`🎯 Target account: @${targetUsername} (${TARGET_TWITTER_ID})`);

    // ===== FLOW STEP 4: Check if user is following the target account =====
    // CRITICAL: This also handles self-follow detection
    console.log(`🔄 Step 4: Checking if @${twitterUsername} follows @${targetUsername}...`);
    const followResult = await checkFollowEnhanced(
      tokenResp.access_token, 
      twitterUserId, 
      TARGET_TWITTER_ID,
      targetUsername || undefined
    );

    console.log('📊 Follow check result:', followResult);

    // ===== FLOW STEP 5: Determine final state based on follow status =====
    // State 2: Authenticated but not following
    // State 3: Authenticated and following (complete)
    const isSelfFollow = twitterUserId === TARGET_TWITTER_ID;
    
    // ===== CRITICAL: Handle self-follow case =====
    // User cannot follow themselves, so we mark as "not following" (state 2)
    // Do NOT enable Telegram button (tgState stays at current value, not changed to 1)
    const finalState = isSelfFollow ? 2 : (followResult.isFollowing ? 3 : 2);
    
    // Only update follow status if NOT self-follow
    if (!isSelfFollow) {
      await updateTwitterProgress(
        address, 
        twitterUsername, 
        twitterUserId,
        followResult.isFollowing
      );
    } else {
      // For self-follow, only update Twitter info without changing follow status
      await updateTwitterProgress(
        address, 
        twitterUsername, 
        twitterUserId,
        false // Explicitly set to not following
      );
    }

    console.log(`💾 Updated progress: state=${finalState}, following=${followResult.isFollowing && !isSelfFollow}, selfFollow=${isSelfFollow}`);

    // ===== FLOW STEP 6: Build redirect URL with result parameters =====
    const redirectUrl = new URL(returnUrl, baseUrl);
    
    // ===== CASE 1: Self-follow attempt =====
    if (isSelfFollow) {
      redirectUrl.searchParams.set("twitter_result", "self_follow");
      redirectUrl.searchParams.set("is_following", "false");
      redirectUrl.searchParams.set("username", twitterUsername);
      redirectUrl.searchParams.set("toast_type", "error");
      redirectUrl.searchParams.set("toast_message", `You cannot follow your own account (@${twitterUsername}). Please use a different account.`);
      
      console.log(`⚠️ Self-follow attempt detected for @${twitterUsername}`);
      
    // ===== CASE 2: User is successfully following =====
    } else if (followResult.isFollowing) {
      redirectUrl.searchParams.set("twitter_result", recheck ? "recheck_success" : "success");
      redirectUrl.searchParams.set("is_following", "true");
      redirectUrl.searchParams.set("username", twitterUsername);
      redirectUrl.searchParams.set("toast_type", "success");
      redirectUrl.searchParams.set("toast_message", `✅ Successfully verified! You are following @${targetUsername}.`);
      
      console.log(`✅ Success: @${twitterUsername} is following @${targetUsername}`);
      
    // ===== CASE 3: API couldn't verify, needs manual check =====
    } else if (followResult.needsManualCheck) {
      redirectUrl.searchParams.set("twitter_result", "manual_check");
      redirectUrl.searchParams.set("is_following", "false");
      redirectUrl.searchParams.set("username", twitterUsername);
      redirectUrl.searchParams.set("target_username", targetUsername || "");
      redirectUrl.searchParams.set("profile_url", followResult.profileUrl || "");
      redirectUrl.searchParams.set("toast_type", "warning");
      redirectUrl.searchParams.set("toast_message", `Connected as @${twitterUsername}. Manual verification required.`);
      
      console.log(`⚠️ Manual check needed for @${twitterUsername}`);
      
    // ===== CASE 4: User is not following, redirect to profile =====
    } else if (followResult.redirectToProfile) {
      redirectUrl.searchParams.set("twitter_result", recheck ? "still_not_following" : "not_following");
      redirectUrl.searchParams.set("is_following", "false");
      redirectUrl.searchParams.set("username", twitterUsername);
      redirectUrl.searchParams.set("target_username", targetUsername || "");
      redirectUrl.searchParams.set("profile_url", followResult.profileUrl || "");
      redirectUrl.searchParams.set("needs_follow", "true");
      
      // Don't show toast here - let the client handle modal
      if (recheck) {
        redirectUrl.searchParams.set("toast_type", "error");
        redirectUrl.searchParams.set("toast_message", `❌ Still not following @${targetUsername}. Please follow and try again.`);
      }
      
      console.log(`❌ Not following: @${twitterUsername} needs to follow @${targetUsername}`);
      
    // ===== CASE 5: Default - authenticated but status unclear =====
    } else {
      redirectUrl.searchParams.set("twitter_result", "authenticated");
      redirectUrl.searchParams.set("is_following", "false");
      redirectUrl.searchParams.set("username", twitterUsername);
      redirectUrl.searchParams.set("target_username", targetUsername || "");
      redirectUrl.searchParams.set("toast_type", "info");
      redirectUrl.searchParams.set("toast_message", `Connected as @${twitterUsername}. Please complete follow verification.`);
      
      console.log(`✅ Authenticated but not following: @${twitterUsername}`);
    }

    return Response.redirect(redirectUrl.toString());

  } catch (err: unknown) {
    console.error('❌ Twitter callback error:', err);

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const redirectUrl = new URL(returnUrl, baseUrl);
    redirectUrl.searchParams.set("twitter_result", "error");
    redirectUrl.searchParams.set("toast_type", "error");
    redirectUrl.searchParams.set("toast_message", err instanceof Error ? err.message : String(err));

    return Response.redirect(redirectUrl.toString());
  }
}

// ===== FLOW SUMMARY =====
// 1. Validate OAuth callback parameters (code, state)
// 2. Exchange authorization code for access token
// 3. Get authenticated user's Twitter profile
// 4. Get target account information
// 5. Check if user follows target (with self-follow detection)
// 6. Update database with follow status
// 7. Redirect with appropriate result parameters
// 8. Client handles toast notifications and modal display