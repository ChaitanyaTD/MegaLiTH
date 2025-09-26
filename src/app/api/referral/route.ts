import { generateReferral } from "@/services/referralService";
import { NextRequest } from "next/server";


export async function POST(req: NextRequest) {
  const { address } = await req.json();
  if (!address) return new Response("address required", { status: 400 });

  try {
    const referral = await generateReferral(address);
    return Response.json(referral);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to generate referral";
    return new Response(message, { status: 400 });
  }
}
