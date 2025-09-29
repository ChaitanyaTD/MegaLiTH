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
  
  // Get base URL for redirects
  const baseUrl = process.env.NEXTAUTH_URL;
  
  // Handle OAuth errors
  if (error) {
    const errorDescription = req.nextUrl.searchParams.get("error_description");
    console.error('Twitter OAuth error:', error, errorDescription);
    
    const redirectUrl = new URL("/dashboard", baseUrl);
    redirectUrl.searchParams.set("twitter_result", "error");
    redirectUrl.searchParams.set("error_message", errorDescription || error);
    
    return Response.redirect(redirectUrl.toString());
  }
  
  if (!code || !state) {
    console.error('Missing code or state in callback');
    const redirectUrl = new URL("/dashboard", baseUrl);
    redirectUrl.searchParams.set("twitter_result", "error");
    redirectUrl.searchParams.set("error_message", "Missing authorization code or state");
    return Response.redirect(redirectUrl.toString());
  }

  let payload: CallbackStatePayload;
  try {
    payload = verifyState(state);
  } catch (e: unknown) {
    console.error('State verification failed:', e);
    const redirectUrl = new URL("/dashboard", baseUrl);
    redirectUrl.searchParams.set("twitter_result", "error");
    redirectUrl.searchParams.set("error_message", "Invalid state parameter");
    return Response.redirect(redirectUrl.toString());
  }

  const { address, codeVerifier, returnUrl = "/dashboard", recheck = false } = payload;

  try {
    // 1️⃣ Exchange code for token
    console.log('Exchanging code for token...');
    const tokenResp: TwitterTokenResponse = await exchangeCodeForToken(code, codeVerifier);

    // 2️⃣ Get Twitter user info
    console.log('Getting Twitter user info...');
    const userResp: TwitterUserResponse = await getTwitterUser(tokenResp.access_token);
    const twitterUsername = userResp.data?.username;
    const twitterUserId = userResp.data?.id;

    if (!twitterUsername || !twitterUserId) {
      throw new Error("Failed to get Twitter user information");
    }

    console.log(`Twitter user authenticated: @${twitterUsername} (${twitterUserId})`);

    // 3️⃣ Get target account info
    const TARGET_TWITTER_ID = process.env.TARGET_TWITTER_ID!;
    const TARGET_TWITTER_USERNAME = process.env.TARGET_TWITTER_USERNAME; // Add this to your env
    
    // Get target username if not in env
    let targetUsername: string | undefined = TARGET_TWITTER_USERNAME;
    if (!targetUsername) {
      const fetchedUsername = await getTwitterUsernameById(tokenResp.access_token, TARGET_TWITTER_ID);
      targetUsername = fetchedUsername || undefined;
    }

    // 4️⃣ Check if user is following the target account
    console.log(`Checking if @${twitterUsername} follows target ${TARGET_TWITTER_ID}`);
    const followResult = await checkFollowEnhanced(
      tokenResp.access_token, 
      twitterUserId, 
      TARGET_TWITTER_ID,
      targetUsername || undefined
    );

    console.log('Follow check result:', followResult);

    // 5️⃣ Update database based on follow status
    const finalState = followResult.isFollowing ? 3 : 2;
    await updateTwitterProgress(
      address, 
      twitterUsername, 
      twitterUserId,
      followResult.isFollowing
    );

    // 6️⃣ Build redirect URL with appropriate result
    const baseUrl = process.env.NEXTAUTH_URL;
    const redirectUrl = new URL(returnUrl, baseUrl);
    
    if (followResult.isFollowing) {
      // User is following - success case
      redirectUrl.searchParams.set("twitter_result", "success");
      redirectUrl.searchParams.set("is_following", "true");
      redirectUrl.searchParams.set("username", twitterUsername);
      
      console.log(`✅ Success: @${twitterUsername} is following target`);
      
    } else if (followResult.needsManualCheck) {
      // API couldn't verify, needs manual check
      redirectUrl.searchParams.set("twitter_result", "manual_check");
      redirectUrl.searchParams.set("is_following", "false");
      redirectUrl.searchParams.set("username", twitterUsername);
      redirectUrl.searchParams.set("target_username", targetUsername || "");
      redirectUrl.searchParams.set("profile_url", followResult.profileUrl || "");
      
      console.log(`⚠️ Manual check needed for @${twitterUsername}`);
      
    } else if (followResult.redirectToProfile) {
      // User is not following, redirect to profile
      redirectUrl.searchParams.set("twitter_result", "not_following");
      redirectUrl.searchParams.set("is_following", "false");
      redirectUrl.searchParams.set("username", twitterUsername);
      redirectUrl.searchParams.set("target_username", targetUsername || "");
      redirectUrl.searchParams.set("profile_url", followResult.profileUrl || "");
      redirectUrl.searchParams.set("needs_follow", "true");
      
      console.log(`❌ Not following: @${twitterUsername} needs to follow target`);
      
    } else {
      // Default case - authenticated but not following
      redirectUrl.searchParams.set("twitter_result", "authenticated");
      redirectUrl.searchParams.set("is_following", "false");
      redirectUrl.searchParams.set("username", twitterUsername);
      redirectUrl.searchParams.set("target_username", targetUsername || "");
      
      console.log(`✅ Authenticated but not following: @${twitterUsername}`);
    }

    // Special handling for recheck scenarios
    if (recheck) {
      if (followResult.isFollowing) {
        redirectUrl.searchParams.set("twitter_result", "recheck_success");
      } else {
        redirectUrl.searchParams.set("twitter_result", "still_not_following");
        redirectUrl.searchParams.set("target_username", targetUsername || "");
        redirectUrl.searchParams.set("profile_url", followResult.profileUrl || "");
      }
    }

    return Response.redirect(redirectUrl.toString());

  } catch (err: unknown) {
  console.error('Twitter callback error:', err);

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const redirectUrl = new URL(returnUrl, baseUrl);
  redirectUrl.searchParams.set("twitter_result", "error");
  redirectUrl.searchParams.set(
    "error_message",
    err instanceof Error ? err.message : String(err)
  );

  return Response.redirect(redirectUrl.toString());
}

}