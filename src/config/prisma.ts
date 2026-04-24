import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env["DATABASE_URL"] ?? "";
const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });

export const connectDB = async (): Promise<void> => {
  await prisma.$connect();
  console.log("✅ Database connected successfully.");
};

export default prisma;
