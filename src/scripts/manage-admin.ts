// scripts/manage-admin.ts
// Node.js script to manage admin addresses using Prisma

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

async function addAdmin(address: string) {
  try {
    if (!address) {
      log(colors.red, 'Error: Address is required');
      showUsage();
      process.exit(1);
    }

    // Convert to lowercase
    const normalizedAddress = address.toLowerCase();

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedAddress)) {
      log(colors.red, 'Error: Invalid Ethereum address format');
      process.exit(1);
    }

    log(colors.yellow, `Adding admin: ${normalizedAddress}`);

    // Check if admin already exists
    const existing = await prisma.admin.findUnique({
      where: { address: normalizedAddress }
    });

    if (existing) {
      log(colors.yellow, '⚠ Admin address already exists');
      process.exit(0);
    }

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        address: normalizedAddress
      }
    });

    log(colors.green, '✓ Admin added successfully');
    console.log(`ID: ${admin.id}`);
    console.log(`Address: ${admin.address}`);
    console.log(`Created: ${admin.createdAt}`);

  } catch (error) {
    log(colors.red, `✗ Failed to add admin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

async function removeAdmin(address: string) {
  try {
    if (!address) {
      log(colors.red, 'Error: Address is required');
      showUsage();
      process.exit(1);
    }

    const normalizedAddress = address.toLowerCase();

    log(colors.yellow, `Removing admin: ${normalizedAddress}`);

    const deleted = await prisma.admin.delete({
      where: { address: normalizedAddress }
    }).catch(() => null);

    if (deleted) {
      log(colors.green, '✓ Admin removed successfully');
    } else {
      log(colors.red, '✗ Admin address not found');
      process.exit(1);
    }

  } catch (error) {
    log(colors.red, `✗ Failed to remove admin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

async function listAdmins() {
  try {
    log(colors.yellow, 'Current Admin Addresses:');
    console.log('----------------------------------------');

    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'desc' }
    });

    if (admins.length === 0) {
      console.log('No admins found');
    } else {
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. ${colors.green}${admin.address}${colors.reset}`);
        console.log(`   Added: ${admin.createdAt.toLocaleString()}`);
        console.log(`   ID: ${admin.id}`);
        console.log('');
      });
    }

    console.log('----------------------------------------');
    log(colors.green, `Total admins: ${admins.length}`);

  } catch (error) {
    log(colors.red, `✗ Failed to list admins: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

function showUsage() {
  console.log(`
Usage: npm run manage-admin <command> [address]

Commands:
  add <address>     Add an address as admin
  remove <address>  Remove an address from admins
  list              List all admin addresses

Examples:
  npm run manage-admin add 0x1234567890abcdef1234567890abcdef12345678
  npm run manage-admin remove 0x1234567890abcdef1234567890abcdef12345678
  npm run manage-admin list

OR using tsx directly:
  npx tsx scripts/manage-admin.ts add 0x1234567890abcdef1234567890abcdef12345678
  `);
}

async function main() {
  const command = process.argv[2];
  const address = process.argv[3];

  try {
    switch (command) {
      case 'add':
        await addAdmin(address);
        break;
      case 'remove':
        await removeAdmin(address);
        break;
      case 'list':
        await listAdmins();
        break;
      default:
        showUsage();
        process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  log(colors.red, `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(1);
});