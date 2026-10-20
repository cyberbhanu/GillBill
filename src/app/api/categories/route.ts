import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["PRODUCT", "FOOD"]),
});

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
    const parsed = categorySchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Enter a category name and type." }, { status: 400 });
    const category = await prisma.category.create({
      data: {
        businessId: actor.businessId,
        name: parsed.data.name,
        kind: parsed.data.kind,
      },
    });
    return Response.json({ category });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requirePermission("categories");
    const body = await request.json();
    const parsed = categorySchema.extend({ id: z.string().min(1) }).safeParse(body);
    if (!parsed.success) return Response.json({ error: "Enter a category name and type." }, { status: 400 });
    const category = await prisma.category.findFirst({ where: { id: parsed.data.id, businessId: actor.businessId } });
    if (!category) return Response.json({ error: "Category not found." }, { status: 404 });
    const updated = await prisma.category.update({
      where: { id: category.id },
      data: { name: parsed.data.name, kind: parsed.data.kind },
    });
    return Response.json({ category: updated });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requirePermission("categories");
    const { id } = await request.json();
    if (typeof id !== "string" || !id) return Response.json({ error: "Category ID is required." }, { status: 400 });
    const category = await prisma.category.findFirst({ where: { id, businessId: actor.businessId } });
    if (!category) return Response.json({ error: "Category not found." }, { status: 404 });
    const products = await prisma.product.count({ where: { businessId: actor.businessId, categoryId: id } });
    if (products) return Response.json({ error: `Move or remove the ${products} product(s) in this category before deleting it.` }, { status: 409 });
    const children = await prisma.category.count({ where: { businessId: actor.businessId, parentId: id } });
    if (children) return Response.json({ error: "Delete or move this category's subcategories first." }, { status: 409 });
    await prisma.category.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
