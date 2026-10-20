import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { token, password } = await request.json().catch(() => ({}));
  if (!token || !password || String(password).length < 8) {
    return Response.json({ error: "A valid token and new password are required." }, { status: 400 });
  }
  const tokenHash = createHash("sha256").update(String(token)).digest("hex");
  const record = await prisma.passwordReset.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return Response.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await bcrypt.hash(String(password), 12) },
    }),
    prisma.passwordReset.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
  return Response.json({ ok: true });
}
