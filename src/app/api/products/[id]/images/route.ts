import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";
import { saveImageFile } from "@/lib/uploads";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("products");
    const { id } = await params;
    const product = await prisma.product.findFirst({ where: { id, businessId: actor.businessId } });
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose an image file." }, { status: 400 });
    const url = await saveImageFile(file, actor.businessId);
    const replace = form.get("replace") === "true";
    const image = await prisma.$transaction(async (tx) => {
      if (replace) await tx.productImage.updateMany({ where: { productId: id }, data: { sortOrder: { increment: 1 } } });
      return tx.productImage.create({ data: { productId: id, url, sortOrder: 0 } });
    });
    return Response.json({ image });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("products");
    const { id } = await params;
    const { imageId } = await request.json();
    await prisma.productImage.deleteMany({
      where: { id: imageId, product: { id, businessId: actor.businessId } },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
