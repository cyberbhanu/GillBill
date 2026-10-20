import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/session";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ user: null });
    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id, isActive: true },
      include: { business: true, branch: true },
    });
    return Response.json({ user: session.user, memberships });
  } catch (error) {
    return jsonError(error);
  }
}
