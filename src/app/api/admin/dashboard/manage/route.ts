// app/api/admin/manage/route.ts
// Alternative: Manage admins via API endpoint

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// SUPER_ADMIN_ADDRESS should be set as environment variable for security
const SUPER_ADMIN_ADDRESS = process.env.SUPER_ADMIN_ADDRESS?.toLowerCase();

async function verifySuperAdmin(address: string): Promise<boolean> {
  if (!SUPER_ADMIN_ADDRESS) {
    console.error("SUPER_ADMIN_ADDRESS not configured");
    return false;
  }
  return address.toLowerCase() === SUPER_ADMIN_ADDRESS;
}

export async function POST(req: NextRequest) {
  try {
    const { action, address, superAdminAddress } = await req.json();
    
    if (!superAdminAddress) {
      return new Response(
        JSON.stringify({ error: "Super admin address required" }), 
        { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Verify super admin
    const isSuperAdmin = await verifySuperAdmin(superAdminAddress);
    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Super admin access required" }), 
        { 
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const normalizedAddress = address.toLowerCase();

    // Validate Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedAddress)) {
      return new Response(
        JSON.stringify({ error: "Invalid Ethereum address format" }), 
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    switch (action) {
      case 'add': {
        const admin = await prisma.admin.upsert({
          where: { address: normalizedAddress },
          update: {},
          create: { address: normalizedAddress }
        });
        
        return Response.json({ 
          success: true, 
          message: "Admin added successfully",
          admin 
        });
      }

      case 'remove': {
        await prisma.admin.delete({
          where: { address: normalizedAddress }
        });
        
        return Response.json({ 
          success: true, 
          message: "Admin removed successfully" 
        });
      }

      case 'list': {
        const admins = await prisma.admin.findMany({
          orderBy: { createdAt: 'desc' }
        });
        
        return Response.json({ 
          success: true, 
          admins,
          total: admins.length
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use 'add', 'remove', or 'list'" }), 
          { 
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to manage admin";
    return new Response(
      JSON.stringify({ error: message }), 
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}