import { NextRequest } from "next/server";
import { createHash, randomBytes, createHmac, randomUUID } from "crypto";

const STATE_SECRET = process.env.STATE_SECRET || "default-secret";

type AuthStatePayload = {
  uuid: string;
  address: string;
  codeVerifier: string;
  returnUrl?: string;
  recheck?: boolean;
  timestamp?: number;
};

function signState(payload: AuthStatePayload) {
  const data = JSON.stringify(payload);
  const hmac = createHmac("sha256", STATE_SECRET).update(data).digest("hex");
  return Buffer.from(JSON.stringify({ payload, sig: hmac })).toString("base64url");
}

// Dynamically choose redirect URI based on environment
function getRedirectUri() {
  if (process.env.NODE_ENV === "production") {
    // Vercel automatically provides VERCEL_URL for production deployments
    const domain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    if (!domain) {
      throw new Error("Missing VERCEL_URL in production environment");
    }
    return `https://${domain}/api/twitter/callback`;
  }

  // Development: use env var or fallback to localhost
  return process.env.X_REDIRECT_URI || "http://localhost:3000/api/twitter/callback";
}

export async function GET(req: NextRequest) {
  try {
    // ✅ Load environment variables
    const X_CLIENT_ID = process.env.X_CLIENT_ID;
    const redirectUri = getRedirectUri();
    const TARGET_TWITTER_ID = process.env.TARGET_TWITTER_ID;
    const TARGET_TWITTER_USERNAME = process.env.TARGET_TWITTER_USERNAME;

    if (!X_CLIENT_ID || !redirectUri || !TARGET_TWITTER_ID) {
      console.error("Missing required environment variables:", {
        X_CLIENT_ID: !!X_CLIENT_ID,
        redirectUri,
        TARGET_TWITTER_ID: !!TARGET_TWITTER_ID,
        TARGET_TWITTER_USERNAME: !!TARGET_TWITTER_USERNAME
      });
      return new Response(
        JSON.stringify({
          error: "Server configuration error",
          message: "Twitter integration is not properly configured"
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ✅ Parse query params
    const address = req.nextUrl.searchParams.get("address");
    const returnUrl = req.nextUrl.searchParams.get("returnUrl") || "/dashboard";
    const recheck = req.nextUrl.searchParams.get("recheck") === "true";

    if (!address || address.length < 10) {
      return new Response(
        JSON.stringify({
          error: "Invalid parameter",
          message: "Valid wallet address is required"
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(
      `🔑 Initiating Twitter auth for address: ${address}${recheck ? " (recheck)" : ""}`
    );
    console.log(`🌐 Using redirect URI: ${redirectUri}`);

    // ✅ Generate PKCE code verifier & challenge
    const codeVerifier = randomBytes(64).toString("base64url");
    const hash = createHash("sha256").update(codeVerifier).digest();
    const codeChallenge = Buffer.from(hash)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // ✅ Build state payload
    const payload: AuthStatePayload = {
      uuid: randomUUID(),
      address,
      codeVerifier,
      returnUrl,
      recheck,
      timestamp: Date.now()
    };

    const STATE = signState(payload);

    // ✅ Build Twitter OAuth URL
    const url = new URL("https://twitter.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", X_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", ["tweet.read", "users.read", "follows.read", "offline.access"].join(" "));
    url.searchParams.set("state", STATE);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    console.log(`✅ OAuth URL generated successfully`);

    return new Response(
      JSON.stringify({
        ok: true,
        url: url.toString(),
        message: `Authorization URL generated successfully${recheck ? " (recheck)" : ""}`,
        recheck
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("❌ Auth route error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "Failed to initiate Twitter authentication",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
