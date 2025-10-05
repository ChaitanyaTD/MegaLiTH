import fetch from "node-fetch";
import { prisma } from "@/lib/prisma";

export type TwitterTokenResponse = {
  token_type: string;
  expires_in: number;
  access_token: string;
  scope: string;
  refresh_token?: string;
};

export type TwitterUserResponse = {
  data?: {
    id: string;
    username: string;
    name: string;
  };
};

export type FollowCheckResult = {
  isFollowing: boolean;
  needsManualCheck: boolean;
  redirectToProfile?: boolean;
  profileUrl?: string;
};

function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

// === Token exchange ===
export async function exchangeCodeForToken(code: string, codeVerifier: string) {
  const X_CLIENT_ID = requireEnvVar("X_CLIENT_ID");
  const X_CLIENT_SECRET = requireEnvVar("X_CLIENT_SECRET");
  const X_REDIRECT_URI =
    process.env.NODE_ENV === "development"
      ? `https://${process.env.VERCEL_URL}/api/twitter/callback`
      : requireEnvVar("X_REDIRECT_URI");

  const params = new URLSearchParams({
    client_id: X_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: X_REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const credentials = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64");

  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitter token exchange failed: ${res.status} ${res.statusText} — ${body}`);
  }

  return res.json() as Promise<TwitterTokenResponse>;
}

// === Refresh Access Token ===
export async function refreshAccessToken(refreshToken: string): Promise<TwitterTokenResponse> {
  const X_CLIENT_ID = requireEnvVar("X_CLIENT_ID");
  const X_CLIENT_SECRET = requireEnvVar("X_CLIENT_SECRET");
  
  const params = new URLSearchParams({
    client_id: X_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  
  const credentials = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64");
  
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: params.toString(),
  });
  
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitter token refresh failed: ${res.status} ${res.statusText} — ${body}`);
  }
  
  return res.json() as Promise<TwitterTokenResponse>;
}

// === Fetch Twitter user ===
export async function getTwitterUser(accessToken: string): Promise<TwitterUserResponse> {
  try {
    const res = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      return res.json() as Promise<TwitterUserResponse>;
    }
  } catch (error) {
    console.warn("v2 fetch failed, trying v1.1", error);
  }

  // fallback v1.1
  const resV1 = await fetch("https://api.twitter.com/1.1/account/verify_credentials.json", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resV1.ok) throw new Error("Failed to fetch Twitter user");

  const userData = (await resV1.json()) as { id_str: string; screen_name: string; name: string };

  return {
    data: {
      id: userData.id_str,
      username: userData.screen_name,
      name: userData.name,
    },
  };
}

// === Utility: Delay function ===
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// === IMPROVED: Check following with pagination and retries ===
interface TwitterV2FollowingResponse {
  data?: Array<{ id: string; username: string }>;
  meta?: { 
    result_count: number;
    next_token?: string;
  };
}

async function checkFollowV2FollowingWithPagination(
  accessToken: string, 
  twitterUserId: string, 
  targetId: string,
  maxResults: number = 1000
): Promise<boolean | null> {
  try {
    let nextToken: string | undefined;
    let checkedCount = 0;
    const maxToCheck = 5000; // Don't check more than 5000 follows
    
    do {
      const url = new URL(`https://api.twitter.com/2/users/${twitterUserId}/following`);
      url.searchParams.set('user.fields', 'id,username');
      url.searchParams.set('max_results', maxResults.toString());
      if (nextToken) {
        url.searchParams.set('pagination_token', nextToken);
      }
      
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) {
        if (res.status === 429) {
          console.warn("Rate limited on following check");
          return null;
        }
        console.warn(`Following check failed: ${res.status}`);
        return null;
      }

      const data = (await res.json()) as TwitterV2FollowingResponse;
      
      if (data.data) {
        // Check if target is in this batch
        const found = data.data.some((u) => u.id === targetId);
        if (found) {
          console.log(`✅ Found target in following list (checked ${checkedCount + data.data.length} accounts)`);
          return true;
        }
        
        checkedCount += data.data.length;
      }
      
      nextToken = data.meta?.next_token;
      
      // Stop if we've checked enough or no more pages
      if (checkedCount >= maxToCheck || !nextToken) {
        break;
      }
      
      // Small delay between pagination requests
      await delay(100);
      
    } while (nextToken);
    
    console.log(`❌ Target not found in ${checkedCount} following accounts`);
    return false;
    
  } catch (error) {
    console.error("Error checking following with pagination:", error);
    return null;
  }
}

// === IMPROVED: Follow check with retries and delays ===
export async function checkFollowEnhanced(
  accessToken: string,
  twitterUserId: string,
  targetId: string,
  targetUsername?: string
): Promise<FollowCheckResult> {
  // Self-follow check
  if (twitterUserId === targetId) {
    return { isFollowing: true, needsManualCheck: false };
  }

  console.log(`🔍 Checking if ${twitterUserId} follows ${targetId}...`);

  // Try multiple times with delays to account for Twitter's eventual consistency
  const maxAttempts = 3;
  const delays = [0, 2000, 5000]; // 0ms, 2s, 5s delays
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (delays[attempt] > 0) {
      console.log(`⏳ Waiting ${delays[attempt]}ms before attempt ${attempt + 1}...`);
      await delay(delays[attempt]);
    }
    
    console.log(`🔄 Follow check attempt ${attempt + 1}/${maxAttempts}`);
    
    // Method 1: Check following list with pagination (most reliable)
    try {
      const followingResult = await checkFollowV2FollowingWithPagination(
        accessToken, 
        twitterUserId, 
        targetId,
        1000
      );
      
      if (followingResult === true) {
        return { isFollowing: true, needsManualCheck: false };
      }
      
      // If we got a definitive false (not null), and it's not the first attempt, trust it
      if (followingResult === false && attempt > 0) {
        console.log(`📋 Following list check returned false on attempt ${attempt + 1}`);
        // Continue to try other methods
      }
    } catch (error) {
      console.warn(`Following list check failed on attempt ${attempt + 1}:`, error);
    }
    
    // Method 2: v1.1 friendships/show (as backup)
    if (attempt > 0) { // Only try after first attempt fails
      try {
        const v1Result = await checkFollowV1(accessToken, twitterUserId, targetId);
        if (v1Result === true) {
          return { isFollowing: true, needsManualCheck: false };
        }
      } catch (error) {
        console.warn(`v1.1 friendship check failed on attempt ${attempt + 1}:`, error);
      }
    }
  }

  // All attempts failed - assume not following
  console.log(`❌ All follow check attempts completed - assuming not following`);
  
  return {
    isFollowing: false,
    needsManualCheck: false,
    redirectToProfile: true,
    profileUrl: targetUsername ? `https://twitter.com/${targetUsername}` : undefined,
  };
}

// --- Twitter v1 Friendships ---
interface TwitterFriendshipShowResponse {
  relationship?: { source?: { following?: boolean } };
}

async function checkFollowV1(
  accessToken: string, 
  twitterUserId: string, 
  targetId: string
): Promise<boolean | null> {
  try {
    const res = await fetch(
      `https://api.twitter.com/1.1/friendships/show.json?source_id=${twitterUserId}&target_id=${targetId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      console.warn(`v1.1 friendships/show failed: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as TwitterFriendshipShowResponse;
    const isFollowing = data.relationship?.source?.following || false;
    
    console.log(`v1.1 friendships/show result: ${isFollowing}`);
    return isFollowing;
  } catch (error) {
    console.error("v1.1 friendship check error:", error);
    return null;
  }
}

// --- Backward compatible simple check ---
export async function checkFollow(accessToken: string, twitterUserId: string, targetId: string): Promise<boolean> {
  const result = await checkFollowEnhanced(accessToken, twitterUserId, targetId);
  return result.isFollowing;
}

// --- Manual follow verification ---
export async function initiateManualFollowCheck(twitterUsername: string, targetUsername: string) {
  const verificationCode = Math.random().toString(36).substring(2, 15);
  return {
    verificationCode,
    instructions: `Please follow @${targetUsername} and then tweet: "Verification code: ${verificationCode}" to complete verification.`,
    profileUrl: `https://twitter.com/${targetUsername}`,
  };
}

// --- Verify via Tweet ---
export async function verifyFollowByTweet(accessToken: string, twitterUserId: string, verificationCode: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.twitter.com/2/users/${twitterUserId}/tweets?max_results=10&tweet.fields=created_at,text`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) return false;

    const data = (await res.json()) as { data?: { text: string }[] };

    return (data.data || []).some((tweet) => tweet.text.includes(verificationCode));
  } catch {
    return false;
  }
}

// --- OLD: Update progress WITHOUT refresh token (keep for compatibility) ---
export async function updateTwitterProgress(
  address: string,
  twitterUsername: string,
  twitterUserId?: string,
  isFollowing?: boolean
) {
  const user = await prisma.user.findUnique({ where: { address } });
  if (!user) throw new Error("User not found");

  const updateData: {
    xState: number;
    twitterId: string;
    twitterUserId?: string;
  } = {
    xState: isFollowing ? 3 : 2,
    twitterId: twitterUsername,
  };

  if (twitterUserId) {
    updateData.twitterUserId = twitterUserId;
  }

  return prisma.userProgress.upsert({
    where: { userId: user.id },
    update: updateData,
    create: {
      userId: user.id,
      ...updateData,
    },
  });
}

// --- NEW: Update progress WITH refresh token ---
export async function updateTwitterProgressWithToken(
  address: string,
  twitterUsername: string,
  twitterUserId: string,
  isFollowing: boolean,
  refreshToken?: string
) {
  const user = await prisma.user.findUnique({ where: { address } });
  if (!user) throw new Error("User not found");
  
  const updateData: {
    xState: number;
    tgState?: number;
    twitterId: string;
    twitterUserId: string;
    twitterRefreshToken?: string;
  } = {
    xState: isFollowing ? 3 : 2,
    twitterId: twitterUsername,
    twitterUserId: twitterUserId,
  };
  
  // If following, also enable Telegram (tgState = 1)
  if (isFollowing) {
    updateData.tgState = 1;
  }
  
  // Store refresh token if provided
  if (refreshToken) {
    updateData.twitterRefreshToken = refreshToken;
  }
  
  return prisma.userProgress.upsert({
    where: { userId: user.id },
    update: updateData,
    create: {
      userId: user.id,
      ...updateData,
    },
  });
}

// --- Helper: get username by ID ---
interface TwitterV2UserLookupResponse {
  data?: Array<{ id: string; username: string }>;
}

export async function getTwitterUsernameById(accessToken: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.twitter.com/2/users/by?ids=${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as TwitterV2UserLookupResponse;

    return data.data?.[0]?.username || null;
  } catch {
    return null;
  }
}