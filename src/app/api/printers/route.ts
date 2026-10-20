import { prisma } from "@/lib/prisma";
import { jsonError, requirePermission } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requirePermission("printers");
    const printers = await prisma.printerSetting.findMany({ where: { businessId: actor.businessId } });
    return Response.json({ printers, paperWidthMm: actor.business.paperWidthMm });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("printers");
    const body = await request.json();
    const printer = await prisma.printerSetting.create({
      data: {
        businessId: actor.businessId,
        name: body.name,
        kind: body.kind || "RECEIPT",
        paperWidth: Number(body.paperWidth ?? 80),
        isDefault: Boolean(body.isDefault),
        notes: body.notes || "Uses the browser print dialog. USB/Bluetooth printers must be installed in Windows/macOS and selected in that dialog. Direct USB access from the browser is not supported.",
      },
    });
    if (body.paperWidth) {
      await prisma.business.update({ where: { id: actor.businessId }, data: { paperWidthMm: Number(body.paperWidth) } });
    }
    return Response.json({ printer });
  } catch (error) {
    return jsonError(error);
  }
}
