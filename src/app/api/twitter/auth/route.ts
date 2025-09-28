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

export async function GET(req: NextRequest) {
  try {
    // Validate environment variables
    const X_CLIENT_ID = process.env.X_CLIENT_ID;
    const X_REDIRECT_URI = process.env.X_REDIRECT_URI;
    const TARGET_TWITTER_ID = process.env.TARGET_TWITTER_ID;
    const TARGET_TWITTER_USERNAME = process.env.TARGET_TWITTER_USERNAME;

    if (!X_CLIENT_ID || !X_REDIRECT_URI || !TARGET_TWITTER_ID) {
      console.error('Missing required environment variables:', {
        X_CLIENT_ID: !!X_CLIENT_ID,
        X_REDIRECT_URI: !!X_REDIRECT_URI,
        TARGET_TWITTER_ID: !!TARGET_TWITTER_ID,
        TARGET_TWITTER_USERNAME: !!TARGET_TWITTER_USERNAME
      });
      return new Response(
        JSON.stringify({
          error: "Server configuration error",
          message: "Twitter integration is not properly configured"
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const address = req.nextUrl.searchParams.get("address");
    const returnUrl = req.nextUrl.searchParams.get("returnUrl") || "/dashboard";
    const recheck = req.nextUrl.searchParams.get("recheck") === "true";
    
    if (!address) {
      return new Response(
        JSON.stringify({
          error: "Missing parameter",
          message: "Wallet address is required"
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Validate address format (basic validation)
    if (typeof address !== 'string' || address.length < 10) {
      return new Response(
        JSON.stringify({
          error: "Invalid parameter",
          message: "Invalid wallet address format"
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    console.log(`Initiating Twitter auth for address: ${address}${recheck ? ' (recheck)' : ''}`);

    // PKCE verifier & challenge
    const codeVerifier = randomBytes(64).toString("base64url");
    const hash = createHash("sha256").update(codeVerifier).digest();
    const codeChallenge = Buffer.from(hash).toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const payload: AuthStatePayload = { 
      uuid: randomUUID(), 
      address, 
      codeVerifier,
      returnUrl,
      recheck,
      timestamp: Date.now()
    };
    
    const STATE = signState(payload);

    // Build authorization URL with comprehensive scopes
    const url = new URL("https://twitter.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", X_CLIENT_ID);
    url.searchParams.set("redirect_uri", X_REDIRECT_URI);
    
    // Request comprehensive scopes for better API access
    const scopes = [
      "tweet.read",
      "users.read", 
      "follows.read",
      "follows.write", // Helps with follow operations
      "offline.access" // For refresh tokens
    ];
    url.searchParams.set("scope", scopes.join(" "));
    
    url.searchParams.set("state", STATE);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    console.log(`Generated OAuth URL for ${recheck ? 'recheck' : 'initial auth'}`);

    return new Response(
      JSON.stringify({ 
        ok: true,
        url: url.toString(),
        message: `Authorization URL generated successfully${recheck ? ' (recheck)' : ''}`,
        recheck
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Auth route error:', error);
    
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "Failed to initiate Twitter authentication",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}