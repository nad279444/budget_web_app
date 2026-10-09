import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const secret = process.env.BETTER_AUTH_SECRET;
const userId = process.env.VERIFY_USER_ID;

const token = "oc_remove_accounts_" + Date.now();
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

await prisma.session.create({ data: { token, userId, expiresAt } });

const sig = createHmac("sha256", secret).update(token).digest("base64");
const cookie = encodeURIComponent(`${token}.${sig}`);
console.log(cookie);

await prisma.$disconnect();