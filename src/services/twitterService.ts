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

// === Follow check ===
export async function checkFollowEnhanced(
  accessToken: string,
  twitterUserId: string,
  targetId: string,
  targetUsername?: string
): Promise<FollowCheckResult> {
  if (twitterUserId === targetId) {
    return { isFollowing: true, needsManualCheck: false };
  }

  const followCheckMethods: (() => Promise<boolean | null>)[] = [
    () => checkFollowV2Following(accessToken, twitterUserId, targetId),
    () => checkFollowV2Lookup(accessToken, twitterUserId, targetId),
    () => checkFollowV1(accessToken, twitterUserId, targetId),
  ];

  for (const method of followCheckMethods) {
    try {
      const result = await method();
      if (result === true) return { isFollowing: true, needsManualCheck: false };
    } catch {
      continue;
    }
  }

  return {
    isFollowing: false,
    needsManualCheck: false,
    redirectToProfile: true,
    profileUrl: targetUsername ? `https://twitter.com/${targetUsername}` : undefined,
  };
}

// --- Twitter v2 Following ---
interface TwitterV2FollowingResponse {
  data?: Array<{ id: string }>;
  meta?: { result_count: number };
}

async function checkFollowV2Following(accessToken: string, twitterUserId: string, targetId: string): Promise<boolean | null> {
  try {
    const res = await fetch(
      `https://api.twitter.com/2/users/${twitterUserId}/following?user.fields=id&max_results=1000`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      if (res.status === 429) return null;
      return null;
    }

    const data = (await res.json()) as TwitterV2FollowingResponse;

    return data.data?.some((u) => u.id === targetId) || false;
  } catch {
    return null;
  }
}

// --- Twitter v2 Lookup ---
interface TwitterV2UserLookupResponse {
  data?: Array<{ id: string; username: string }>;
}

async function checkFollowV2Lookup(accessToken: string, twitterUserId: string, targetId: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://api.twitter.com/2/users/by?ids=${targetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return null;

    return null;
  } catch {
    return null;
  }
}

// --- Twitter v1 Friendships ---
interface TwitterFriendshipShowResponse {
  relationship?: { source?: { following?: boolean } };
}

async function checkFollowV1(accessToken: string, twitterUserId: string, targetId: string): Promise<boolean | null> {
  try {
    const res = await fetch(
      `https://api.twitter.com/1.1/friendships/show.json?source_id=${twitterUserId}&target_id=${targetId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) return null;

    const data = (await res.json()) as TwitterFriendshipShowResponse;

    return data.relationship?.source?.following || false;
  } catch {
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

// --- Update progress in DB (with twitterUserId) ---
export async function updateTwitterProgress(
  address: string,
  twitterUsername: string,
  twitterUserId?: string,
  isFollowing?: boolean
) {
  const user = await prisma.user.findUnique({ where: { address } });
  if (!user) throw new Error("User not found");

  const progressData: {
    xState: number;
    twitterId: string;
    twitterUserId: string | null;
  } = {
    xState: isFollowing ? 3 : 2,
    twitterId: twitterUsername,
    twitterUserId: twitterUserId || null,
  };

  return prisma.userProgress.upsert({
    where: { userId: user.id },
    update: progressData,
    create: {
      userId: user.id,
      ...progressData,
    },
  });
}

// --- Helper: get username by ID ---
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
