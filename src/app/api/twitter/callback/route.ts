import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import {
  exchangeCodeForToken,
  getTwitterUser,
  markTwitterPendingVerification,
  TwitterTokenResponse,
  TwitterUserResponse,
} from "@/services/twitterService";

const STATE_SECRET = process.env.STATE_SECRET || "default-secret";

type CallbackStatePayload = {
  uuid: string;
  address: string;
  codeVerifier: string;
  returnUrl?: string;
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

function buildRedirectUrl(returnUrl: string, params: Record<string, string>): string {
  const url = new URL(returnUrl, 'http://localhost');
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}`;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  
  if (error) {
    const errorDescription = req.nextUrl.searchParams.get("error_description");
    console.error('Twitter OAuth error:', error, errorDescription);
    
    const redirectUrl = buildRedirectUrl("/dashboard", {
      twitter_result: "error",
      toast_message: errorDescription || error
    });
    
    return Response.redirect(new URL(redirectUrl, req.url));
  }
  
  if (!code || !state) {
    const redirectUrl = buildRedirectUrl("/dashboard", {
      twitter_result: "error",
      toast_message: "Missing authorization code or state"
    });
    
    return Response.redirect(new URL(redirectUrl, req.url));
  }

  let payload: CallbackStatePayload;
  try {
    payload = verifyState(state);
  } catch (e: unknown) {
    console.error('State verification failed:', e);
    const redirectUrl = buildRedirectUrl("/dashboard", {
      twitter_result: "error",
      toast_message: "Invalid state parameter"
    });
    
    return Response.redirect(new URL(redirectUrl, req.url));
  }

  const { address, codeVerifier, returnUrl = "/dashboard" } = payload;

  try {
    // STEP 1: Exchange code for token
    console.log('Exchanging code for token...');
    let tokenResp: TwitterTokenResponse;
    
    try {
      tokenResp = await exchangeCodeForToken(code, codeVerifier);
      
      if (!tokenResp.access_token) {
        throw new Error("No access token received");
      }
      
      console.log('Token exchange successful');
      
    } catch (tokenError) {
      console.error('Token exchange failed:', tokenError);
      throw new Error(`Failed to exchange code for token: ${tokenError instanceof Error ? tokenError.message : String(tokenError)}`);
    }

    // STEP 2: Get authenticated user's Twitter info
    console.log('Getting Twitter user info...');
    let userResp: TwitterUserResponse;
    
    try {
      userResp = await getTwitterUser(tokenResp.access_token);
      
      if (!userResp.data?.username || !userResp.data?.id) {
        throw new Error("Missing username or user ID in API response");
      }
      
      console.log('User info retrieved successfully');
      
    } catch (userError) {
      console.error('Failed to fetch Twitter user:', userError);
      throw new Error("Failed to fetch Twitter user information");
    }
    
    const twitterUsername = userResp.data.username;
    const twitterUserId = userResp.data.id;

    console.log(`Authenticated: @${twitterUsername} (${twitterUserId})`);

    const TARGET_TWITTER_ID = process.env.TARGET_TWITTER_ID;
    const TARGET_TWITTER_USERNAME = process.env.TARGET_TWITTER_USERNAME;
    
    if (!TARGET_TWITTER_ID) {
      throw new Error("Server configuration error: TARGET_TWITTER_ID not set");
    }

    // STEP 3: Check if self-follow
    const isSelfFollow = twitterUserId === TARGET_TWITTER_ID;
    
    if (isSelfFollow) {
      console.log(`User @${twitterUsername} is the target account - marking as verified`);
      
      await markTwitterPendingVerification(
        address, 
        twitterUsername, 
        twitterUserId, 
        tokenResp.refresh_token,
        true // isVerified = true for self
      );
      
      const redirectUrl = buildRedirectUrl(returnUrl, {
        twitter_result: "success",
        username: twitterUsername,
        toast_message: `You are the target account owner. All tasks unlocked!`
      });
      
      return Response.redirect(new URL(redirectUrl, req.url));
    }

    // STEP 4: OPTIMISTIC APPROACH - Mark as complete immediately (pending verification)
    console.log(`Marking @${twitterUsername} as complete (pending verification)`);
    
    await markTwitterPendingVerification(
      address, 
      twitterUsername, 
      twitterUserId, 
      tokenResp.refresh_token,
      false // isVerified = false, will be checked by cron
    );

    // STEP 5: Open Twitter profile for user to follow
    const profileUrl = `https://twitter.com/${TARGET_TWITTER_USERNAME}`;
    
    const redirectUrl = buildRedirectUrl(returnUrl, {
      twitter_result: "success",
      username: twitterUsername,
      target_username: TARGET_TWITTER_USERNAME || "",
      profile_url: profileUrl,
      toast_message: `Connected as @${twitterUsername}! Follow @${TARGET_TWITTER_USERNAME} to complete. We'll verify in the background.`
    });
    
    return Response.redirect(new URL(redirectUrl, req.url));

  } catch (err: unknown) {
    console.error('CRITICAL ERROR in Twitter callback:', err);

    let errorMessage = "An error occurred during Twitter authentication";
    
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    
    const redirectUrl = buildRedirectUrl(returnUrl || "/dashboard", {
      twitter_result: "error",
      toast_message: errorMessage
    });

    return Response.redirect(new URL(redirectUrl, req.url));
  }
}