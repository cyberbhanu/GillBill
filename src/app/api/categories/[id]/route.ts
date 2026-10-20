import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("categories");
    const { id } = await params;
    await prisma.$transaction(async (tx) => {
      await tx.category.updateMany({
        where: { parentId: id, businessId: actor.businessId },
        data: { parentId: null },
      });
      await tx.category.deleteMany({ where: { id, businessId: actor.businessId } });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
