import { NextRequest } from "next/server";
import { createHash, randomBytes, createHmac, randomUUID } from "crypto";

const STATE_SECRET = process.env.STATE_SECRET || "default-secret";

type AuthStatePayload = {
  uuid: string;
  address: string;
  codeVerifier: string;
  returnUrl?: string;
  timestamp?: number;
};

function signState(payload: AuthStatePayload) {
  const data = JSON.stringify(payload);
  const hmac = createHmac("sha256", STATE_SECRET).update(data).digest("hex");
  return Buffer.from(JSON.stringify({ payload, sig: hmac })).toString("base64url");
}

export async function GET(req: NextRequest) {
  try {
    const X_CLIENT_ID = process.env.X_CLIENT_ID;
    const X_REDIRECT_URI =
      process.env.NODE_ENV === "development"
        ? `https://${process.env.VERCEL_URL}/api/twitter/callback`
        : process.env.X_REDIRECT_URI;

    if (!X_CLIENT_ID || !X_REDIRECT_URI) {
      return new Response(
        JSON.stringify({
          error: "Server configuration error",
          message: "Twitter integration is not properly configured",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const address = req.nextUrl.searchParams.get("address");
    const returnUrl = req.nextUrl.searchParams.get("returnUrl") || "/dashboard";

    if (!address || typeof address !== "string" || address.length < 10) {
      return new Response(
        JSON.stringify({
          error: "Invalid parameter",
          message: "Valid wallet address is required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Initiating Twitter auth for address: ${address}`);

    // PKCE code verifier & challenge
    const codeVerifier = randomBytes(64).toString("base64url");
    const hash = createHash("sha256").update(codeVerifier).digest();
    const codeChallenge = Buffer.from(hash)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const payload: AuthStatePayload = {
      uuid: randomUUID(),
      address,
      codeVerifier,
      returnUrl,
      timestamp: Date.now(),
    };

    const STATE = signState(payload);

    const url = new URL("https://twitter.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", X_CLIENT_ID);
    url.searchParams.set("redirect_uri", X_REDIRECT_URI);
    url.searchParams.set("scope", "tweet.read users.read follows.read offline.access");
    url.searchParams.set("state", STATE);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    return new Response(
      JSON.stringify({ ok: true, url: url.toString() }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("Auth route error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "Failed to initiate Twitter authentication",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}