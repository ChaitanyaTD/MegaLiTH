import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function generateCode(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(req: NextRequest) {
  const { address } = await req.json();
  if (!address) return new Response("address required", { status: 400 });

  const record = await prisma.userProgress.upsert({
    where: { address },
    update: {
      referralCode: generateCode(),
      refState: 1,
    },
    create: {
      address,
      referralCode: generateCode(),
      xState: 1,
      tgState: 0,
      refState: 1,
    },
  });

  return new Response(JSON.stringify({ referralCode: record.referralCode }), { status: 200 });
}


