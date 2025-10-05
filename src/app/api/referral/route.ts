import { generateReferral } from "@/services/referralService";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { address, type } = await req.json();
    
    if (!address) {
      return new Response(JSON.stringify({ error: "Address required" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!type || (type !== 'twitter' && type !== 'telegram')) {
      return new Response(JSON.stringify({ error: "Type must be 'twitter' or 'telegram'" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const referral = await generateReferral(address, type);
    
    return Response.json(referral);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to generate referral";
    return new Response(JSON.stringify({ error: message }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
} 