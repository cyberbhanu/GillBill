import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";
import { rupeesToPaise } from "@/lib/money";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("products");
    const { id } = await params;
    const product = await prisma.product.findFirst({
      where: { id, businessId: actor.businessId },
      include: { images: true, variants: true, category: true, taxRate: true, recipeItems: true, inventory: true },
    });
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
    return Response.json({ product });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("products");
    const { id } = await params;
    const body = await request.json();
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({ where: { id, businessId: actor.businessId }, select: { id: true } });
      if (!existing) return null;
      await tx.product.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          sku: body.sku,
          barcode: body.barcode,
          brand: body.brand,
          unit: body.unit,
          categoryId: body.categoryId || null,
          taxRateId: body.taxRateId || null,
          supplierId: body.supplierId || null,
          purchasePaise: body.purchasePrice != null ? rupeesToPaise(body.purchasePrice) : undefined,
          sellingPaise: body.sellingPrice != null ? rupeesToPaise(body.sellingPrice) : undefined,
          discountPaise: body.discountPrice != null ? Math.min(rupeesToPaise(body.discountPrice), rupeesToPaise(body.sellingPrice ?? 0)) : undefined,
          trackStock: body.trackStock,
          minStock: body.minStock != null ? Number(body.minStock) : undefined,
          isActive: body.isActive,
          isFavorite: body.isFavorite,
          dietary: body.dietary,
          portion: body.portion,
          prepMinutes: body.prepMinutes != null ? Number(body.prepMinutes) : undefined,
          allergens: body.allergens,
          hsn: body.hsn,
          batchNumber: body.batchNumber,
        },
      });
      if (Array.isArray(body.variants)) {
        const current = await tx.productVariant.findMany({ where: { productId: id, isActive: true }, orderBy: { id: "asc" } });
        const labels = body.variants.map((variant: { name?: unknown }) => String(variant.name ?? "").trim()).filter(Boolean);
        for (const [index, name] of labels.entries()) {
          const variant = current[index];
          if (variant) await tx.productVariant.update({ where: { id: variant.id }, data: { name } });
          else await tx.productVariant.create({ data: { productId: id, name, stockQty: 0 } });
        }
        for (const variant of current.slice(labels.length)) {
          await tx.productVariant.update({ where: { id: variant.id }, data: { isActive: false } });
        }
      }
      return tx.product.findUnique({ where: { id }, include: { images: true, variants: { orderBy: { id: "asc" } }, category: true, inventory: { where: { branchId: actor.branchId } } } });
    });
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
    return Response.json({ product });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("products");
    const { id } = await params;
    await prisma.product.updateMany({
      where: { id, businessId: actor.businessId },
      data: { isActive: false },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
