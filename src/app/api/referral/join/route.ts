import { NextRequest } from "next/server";
import { trackReferralJoin } from "@/services/referralTrackingService";

export async function POST(req: NextRequest) {
  try {
    const { newUserAddress, referralCode } = await req.json();
    
    if (!newUserAddress || !referralCode) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }), 
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const result = await trackReferralJoin({
      newUserAddress,
      referralCode
    });
    
    return Response.json({
      success: true,
      message: "Referral tracked successfully",
      data: result
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to track referral";
    return new Response(
      JSON.stringify({ error: message }), 
      { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}