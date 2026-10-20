import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(8).optional().or(z.literal("")),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Enter a name, email or mobile number, and a password of at least 8 characters." }, { status: 400 });
  }
  const email = parsed.data.email?.trim().toLowerCase() || null;
  const phone = parsed.data.phone?.trim() || null;
  if (!email && !phone) {
    return Response.json({ error: "Provide an email address or mobile number." }, { status: 400 });
  }
  const existing = await prisma.user.findFirst({
    where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
  });
  if (existing) {
    return Response.json({ error: "An account with those details already exists." }, { status: 409 });
  }
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      email,
      phone,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
    },
  });
  return Response.json({ id: user.id });
}
