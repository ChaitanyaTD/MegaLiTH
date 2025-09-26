import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import {
  exchangeCodeForToken,
  getTwitterUser,
  updateTwitterProgress,
  checkFollow,
  TwitterTokenResponse,
  TwitterUserResponse,
} from "@/services/twitterService";

const STATE_SECRET = process.env.STATE_SECRET || "default-secret";

type CallbackStatePayload = {
  uuid: string;
  address?: string;
  codeVerifier?: string;
};

function verifyState(state: string) {
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
  if (!code || !state) return new Response("missing code or state", { status: 400 });

  let payload: CallbackStatePayload;
  try {
    payload = verifyState(state);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(message, { status: 400 });
  }

  const { address, codeVerifier } = payload as { address: string; codeVerifier?: string };

  try {
    // 1️⃣ Exchange code for token
const tokenResp = await exchangeCodeForToken(code, codeVerifier!) as TwitterTokenResponse;

    // 2️⃣ Get Twitter user info
    const userResp: TwitterUserResponse = await getTwitterUser(tokenResp.access_token);
    const twitterUsername = userResp.data?.username;
    const twitterUserId = userResp.data?.id;

    if (!twitterUsername || !twitterUserId) {
      return new Response("Twitter user not found", { status: 500 });
    }

    // 3️⃣ Update DB progress
    if (address) await updateTwitterProgress(address, twitterUsername);

    // 4️⃣ Check if user follows a target account (replace TARGET_TWITTER_ID)
    const TARGET_TWITTER_ID = process.env.TARGET_TWITTER_ID!;
    const isFollowing = await checkFollow(tokenResp.access_token, twitterUserId, TARGET_TWITTER_ID);

    return new Response(
      JSON.stringify({ ok: true, username: twitterUsername, isFollowing }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(String(message), { status: 500 });
  }
}
