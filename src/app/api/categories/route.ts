import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requirePermission("categories");
    const categories = await prisma.category.findMany({
      where: { businessId: actor.businessId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return Response.json({ categories });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("categories");
    const { name, kind, parentId } = await request.json();
    if (!name) return Response.json({ error: "Category name is required." }, { status: 400 });
    const category = await prisma.category.create({
      data: {
        businessId: actor.businessId,
        name: String(name).trim(),
        kind: kind === "FOOD" ? "FOOD" : "PRODUCT",
        parentId: parentId || null,
      },
    });
    return Response.json({ category });
  } catch (error) {
    return jsonError(error);
  }
}
