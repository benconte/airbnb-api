import { PrismaClient } from "../../generated/prisma/client";
import dotenv from 'dotenv';
import path from 'path';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env["DATABASE_URL"] ?? "";

const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Starting listing approval script...");

    // Count unapproved listings first
    const pendingCount = await prisma.listing.count({
        where: {
            isApproved: false,
        },
    });

    if (pendingCount === 0) {
        console.log("No pending listings found.");
        return;
    }

    console.log(`Found ${pendingCount} pending listing(s).`);

    // Update all listings
    const result = await prisma.listing.updateMany({
        where: {
            isApproved: false,
        },
        data: {
            isApproved: true,
        },
    });

    console.log(`Successfully approved ${result.count} listing(s).`);
}

main()
    .catch((e) => {
        console.error("Script failed:");
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });