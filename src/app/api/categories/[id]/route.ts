import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("categories");
    const { id } = await params;
    await prisma.category.deleteMany({ where: { id, businessId: actor.businessId } });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
