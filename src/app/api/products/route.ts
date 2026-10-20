import { prisma } from "@/lib/prisma";
import { jsonError, requireActor, requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { rupeesToPaise } from "@/lib/money";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const { searchParams } = new URL(request.url);
    const pos = searchParams.get("pos") === "1";
    if (!can(actor.role, pos ? "pos" : "products")) {
      return Response.json({ error: "You do not have permission for this action." }, { status: 403 });
    }
    const q = searchParams.get("q")?.trim();
    const categoryId = searchParams.get("categoryId");
    const products = await prisma.product.findMany({
      where: {
        businessId: actor.businessId,
        ...(searchParams.get("pos") === "1" ? { isActive: true } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { sku: { contains: q } },
                { barcode: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { id: "asc" } },
        category: true,
        taxRate: true,
        inventory: { where: { branchId: actor.branchId } },
      },
      orderBy: { name: "asc" },
    });
    return Response.json({ products });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("products");
    const body = await request.json();
    if (!body.name || body.sellingPrice == null) {
      return Response.json({ error: "Product name and selling price are required." }, { status: 400 });
    }
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          businessId: actor.businessId,
          branchId: actor.branchId,
          categoryId: body.categoryId || null,
          taxRateId: body.taxRateId || null,
          supplierId: body.supplierId || null,
          name: String(body.name).trim(),
          description: body.description || null,
          sku: body.sku || null,
          barcode: body.barcode || null,
          brand: body.brand || null,
          unit: body.unit || "piece",
          purchasePaise: rupeesToPaise(body.purchasePrice ?? 0),
          sellingPaise: rupeesToPaise(body.sellingPrice),
          discountPaise: body.discountPrice != null ? rupeesToPaise(body.discountPrice) : null,
          trackStock: body.trackStock !== false,
          minStock: Number(body.minStock ?? 5),
          isActive: body.isActive !== false,
          isFavorite: Boolean(body.isFavorite),
          dietary: body.dietary || null,
          portion: body.portion || null,
          prepMinutes: body.prepMinutes ? Number(body.prepMinutes) : null,
          allergens: body.allergens || null,
          hsn: body.hsn || null,
          batchNumber: body.batchNumber || null,
          expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        },
      });
      const opening = Number(body.stock ?? 0);
      await tx.inventoryBalance.create({
        data: { branchId: actor.branchId, productId: created.id, qty: opening },
      });
      if (opening) {
        await tx.stockMovement.create({
          data: {
            branchId: actor.branchId,
            productId: created.id,
            qtyDelta: opening,
            reason: "OPENING",
            createdBy: actor.userId,
          },
        });
      }
      if (Array.isArray(body.variants)) {
        for (const variant of body.variants) {
          await tx.productVariant.create({
            data: {
              productId: created.id,
              name: variant.name,
              sku: variant.sku || null,
              barcode: variant.barcode || null,
              sellingPaise: variant.sellingPrice != null ? rupeesToPaise(variant.sellingPrice) : null,
              stockQty: Number(variant.stock ?? 0),
            },
          });
        }
      }
      return created;
    });
    return Response.json({ product });
  } catch (error) {
    return jsonError(error);
  }
}
