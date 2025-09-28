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

export async function exchangeCodeForToken(code: string, codeVerifier: string) {
  const X_CLIENT_ID = requireEnvVar('X_CLIENT_ID');
  const X_CLIENT_SECRET = requireEnvVar('X_CLIENT_SECRET');
  const X_REDIRECT_URI = requireEnvVar('X_REDIRECT_URI');

  const params = new URLSearchParams({
    client_id: X_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: X_REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const credentials = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');

  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "Authorization": `Basic ${credentials}`,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Twitter token exchange error:', body);
    throw new Error(`Twitter token exchange failed: ${res.status} ${res.statusText} — ${body}`);
  }

  return res.json() as Promise<TwitterTokenResponse>;
}

export async function getTwitterUser(accessToken: string): Promise<TwitterUserResponse> {
  // Try v2 API first
  try {
    const res = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      return res.json() as Promise<TwitterUserResponse>;
    }

    // Log v2 failure but continue to fallback
    const body = await res.text();
    console.warn('Twitter v2 user fetch failed:', body);
  } catch (error) {
    console.warn('v2 user fetch failed, trying v1.1', error);
  }

  // Fallback to v1.1 if available
  try {
    const res = await fetch("https://api.twitter.com/1.1/account/verify_credentials.json", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const userData = await res.json() as { id_str: string; screen_name: string; name: string };
      return {
        data: {
          id: userData.id_str,
          username: userData.screen_name,
          name: userData.name
        }
      };
    }
  } catch (error) {
    console.warn('v1.1 user fetch also failed', error);
  }

  throw new Error('Unable to fetch Twitter user data with available API access');
}

export async function checkFollowEnhanced(
  accessToken: string, 
  twitterUserId: string, 
  targetId: string,
  targetUsername?: string
): Promise<FollowCheckResult> {
  
  // If user is checking their own account (same ID), they're "following" themselves
  if (twitterUserId === targetId) {
    console.log(`User ${twitterUserId} is checking their own account (target: ${targetId}) - returning true`);
    return {
      isFollowing: true,
      needsManualCheck: false
    };
  }

  console.log(`Checking if user ${twitterUserId} follows target ${targetId}`);

  // Try multiple API approaches - but be more strict about results
  const followCheckMethods = [
    () => checkFollowV2Following(accessToken, twitterUserId, targetId),
    () => checkFollowV2Lookup(accessToken, twitterUserId, targetId),
    () => checkFollowV1(accessToken, twitterUserId, targetId),
  ];

  for (const method of followCheckMethods) {
    try {
      const result = await method();
      console.log(`Follow check method result:`, result);
      
      // Only return true if we have a definitive positive result
      if (result === true) {
        console.log(`✅ Confirmed: User ${twitterUserId} is following ${targetId}`);
        return {
          isFollowing: true,
          needsManualCheck: false
        };
      }
      
      // If result is explicitly false, continue to next method for confirmation
      if (result === false) {
        console.log(`❌ Method returned false - trying next method`);
        continue;
      }
      
      // If result is null, try next method
      if (result === null) {
        console.log(`⚠️ Method returned null - trying next method`);
        continue;
      }
    } catch (error) {
      console.warn('Follow check method failed:', error);
      continue;
    }
  }

  // All API methods either failed or returned false/null
  console.log(`❌ All follow check methods completed - user ${twitterUserId} is NOT following ${targetId}`);
  
  return {
    isFollowing: false,
    needsManualCheck: false, // Changed: Don't default to manual check
    redirectToProfile: true,
    profileUrl: targetUsername ? `https://twitter.com/${targetUsername}` : undefined
  };
}

async function checkFollowV2Following(accessToken: string, twitterUserId: string, targetId: string): Promise<boolean | null> {
  try {
    console.log(`Trying V2 following endpoint for user ${twitterUserId} -> target ${targetId}`);
    
    const res = await fetch(`https://api.twitter.com/2/users/${twitterUserId}/following?user.fields=id&max_results=1000`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log(`V2 following API response: ${res.status} ${res.statusText}`);

    if (res.ok) {
      const data = await res.json() as { data?: Array<{ id: string }>, meta?: { result_count: number } };
      console.log(`V2 following data:`, { 
        resultCount: data.meta?.result_count || 0, 
        hasData: !!data.data,
        dataLength: data.data?.length || 0 
      });
      
      const isFollowing = Array.isArray(data.data) && data.data.some((u) => u.id === targetId);
      console.log(`V2 following result: ${isFollowing}`);
      
      return isFollowing;
    }

    if (res.status === 429) {
      console.warn('Rate limited on v2 following endpoint');
      return null;
    }

    const body = await res.text();
    console.warn('V2 following check failed:', res.status, body);
    return null;
  } catch (error) {
    console.warn('V2 following check error:', error);
    return null;
  }
}

async function checkFollowV2Lookup(accessToken: string, twitterUserId: string, targetId: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://api.twitter.com/2/users/by?ids=${targetId}&expansions=pinned_tweet_id&user.fields=public_metrics`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      // This is a basic check - v2 doesn't easily provide follow status
      // We'll use this as a fallback to verify the target user exists
      const data = await res.json() as any;
      if (data.data && data.data.length > 0) {
        // Target user exists, but we can't determine follow status
        // Return null to try next method
        return null;
      }
    }

    return null;
  } catch (error) {
    console.warn('V2 lookup check error:', error);
    return null;
  }
}

async function checkFollowV1(accessToken: string, twitterUserId: string, targetId: string): Promise<boolean | null> {
  try {
    // Try v1.1 friendships/show endpoint
    const res = await fetch(`https://api.twitter.com/1.1/friendships/show.json?source_id=${twitterUserId}&target_id=${targetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json() as any;
      return data?.relationship?.source?.following === true;
    }

    console.warn('V1 friendship check failed:', res.status);
    return null;
  } catch (error) {
    console.warn('V1 friendship check error:', error);
    return null;
  }
}

// Legacy function for backward compatibility
export async function checkFollow(accessToken: string, twitterUserId: string, targetId: string): Promise<boolean> {
  const result = await checkFollowEnhanced(accessToken, twitterUserId, targetId);
  return result.isFollowing;
}

// Manual verification fallback
export async function initiateManualFollowCheck(twitterUsername: string, targetUsername: string) {
  // Store the verification request in database for later validation
  try {
    const verificationCode = Math.random().toString(36).substring(2, 15);
    
    // You could store this in your database
    // await prisma.followVerification.create({
    //   data: {
    //     twitterUsername,
    //     targetUsername,
    //     verificationCode,
    //     createdAt: new Date(),
    //     verified: false
    //   }
    // });

    return {
      verificationCode,
      instructions: `Please follow @${targetUsername} and then tweet: "Verification code: ${verificationCode}" to complete the verification.`,
      profileUrl: `https://twitter.com/${targetUsername}`
    };
  } catch (error) {
    console.error('Manual follow check initiation failed:', error);
    throw new Error('Could not initiate manual verification');
  }
}

// Alternative: Tweet-based verification
export async function verifyFollowByTweet(accessToken: string, twitterUserId: string, verificationCode: string): Promise<boolean> {
  try {
    // Search for recent tweets by the user containing the verification code
    const res = await fetch(`https://api.twitter.com/2/users/${twitterUserId}/tweets?max_results=10&tweet.fields=created_at,text`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json() as any;
      const tweets = data.data || [];
      
      // Check if any recent tweet contains the verification code
      const hasVerificationTweet = tweets.some((tweet: any) => 
        tweet.text && tweet.text.includes(verificationCode)
      );

      return hasVerificationTweet;
    }

    console.warn('Tweet verification failed:', res.status);
    return false;
  } catch (error) {
    console.warn('Tweet verification error:', error);
    return false;
  }
}

export async function updateTwitterProgress(
  address: string, 
  twitterUsername: string, 
  twitterUserId?: string,
  isFollowing?: boolean
) {
  const user = await prisma.user.findUnique({ where: { address } });
  if (!user) throw new Error("User not found");

  return prisma.userProgress.upsert({
    where: { userId: user.id },
    update: { 
      xState: isFollowing ? 3 : 2, // 3 if following, 2 if just connected
      twitterId: twitterUsername,
      twitterUserId: twitterUserId || null
    },
    create: { 
      userId: user.id, 
      xState: isFollowing ? 3 : 2, 
      twitterId: twitterUsername,
      twitterUserId: twitterUserId || null
    },
  });
}

// Get target username by ID (helper function)
export async function getTwitterUsernameById(accessToken: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.twitter.com/2/users/by?ids=${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json() as any;
      return data.data?.[0]?.username || null;
    }

    return null;
  } catch (error) {
    console.warn('Failed to get username by ID:', error);
    return null;
  }
}