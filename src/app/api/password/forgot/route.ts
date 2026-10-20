import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { identifier } = await request.json().catch(() => ({ identifier: "" }));
  const value = String(identifier ?? "").trim().toLowerCase();
  const user = value
    ? await prisma.user.findFirst({
        where: { OR: [{ email: value }, { phone: value }] },
      })
    : null;

  if (user) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });
    const deploymentUrl = process.env.APP_URL
      ?? process.env.RENDER_EXTERNAL_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
      ?? "http://localhost:3000";
    const resetUrl = `${deploymentUrl.replace(/\/$/, "")}/reset-password?token=${token}`;
    console.info(`[GillBill] Password reset for ${user.email ?? user.phone}: ${resetUrl}`);
    return Response.json({
      ok: true,
      message: "If an account exists, a reset link was generated.",
      demoResetUrl: process.env.NODE_ENV === "production" ? undefined : resetUrl,
    });
  }

  return Response.json({ ok: true, message: "If an account exists, a reset link was generated." });
}

