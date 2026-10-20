import { prisma } from "@/lib/prisma";
import { jsonError, requireActor, requirePermission, requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { saveImageFile } from "@/lib/uploads";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(2),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  upiId: z.string().optional(),
  upiMcc: z.string().regex(/^\d{4}$/).optional(),
  currency: z.string().default("INR"),
  restaurantEnabled: z.boolean().optional(),
  hotelEnabled: z.boolean().optional(),
  groceryEnabled: z.boolean().optional(),
  retailEnabled: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().nullable().optional(), city: z.string().nullable().optional(),
  state: z.string().nullable().optional(), pincode: z.string().nullable().optional(),
  phone: z.string().nullable().optional(), gstin: z.string().nullable().optional(), upiId: z.string().nullable().optional(), upiMcc: z.string().regex(/^\d{4}$/).nullable().optional(), upiQrUrl: z.string().nullable().optional(),
  currency: z.string().length(3).optional(), receiptFooter: z.string().optional(),
  returnPolicy: z.string().nullable().optional(), paperWidthMm: z.number().int().min(40).max(120).optional(),
  preventNegativeStock: z.boolean().optional(), pricesTaxInclusive: z.boolean().optional(),
  restaurantEnabled: z.boolean().optional(), hotelEnabled: z.boolean().optional(),
  groceryEnabled: z.boolean().optional(), retailEnabled: z.boolean().optional(),
  defaultCgstBps: z.number().int().min(0).max(10000).optional(),
  defaultSgstBps: z.number().int().min(0).max(10000).optional(),
  defaultIgstBps: z.number().int().min(0).max(10000).optional(),
});

export async function GET() {
  try {
    const actor = await requireActor();
    return Response.json({
      business: actor.business,
      branchId: actor.branchId,
      role: actor.role,
      branches: await prisma.branch.findMany({ where: { businessId: actor.businessId } }),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "Business details are incomplete." }, { status: 400 });

    const userId = user.id;

    const business = await prisma.$transaction(async (tx) => {
      const created = await tx.business.create({
        data: {
          name: parsed.data.name,
          address: parsed.data.address,
          city: parsed.data.city,
          state: parsed.data.state,
          pincode: parsed.data.pincode,
          phone: parsed.data.phone,
          gstin: parsed.data.gstin,
          currency: parsed.data.currency,
          restaurantEnabled: parsed.data.restaurantEnabled ?? false,
          hotelEnabled: parsed.data.hotelEnabled ?? false,
          groceryEnabled: parsed.data.groceryEnabled ?? true,
          retailEnabled: parsed.data.retailEnabled ?? true,
        },
      });
      const branch = await tx.branch.create({
        data: { businessId: created.id, name: "Main branch", isDefault: true, address: parsed.data.address, phone: parsed.data.phone },
      });
      await tx.membership.create({
        data: { userId, businessId: created.id, branchId: branch.id, role: "OWNER" },
      });
      await tx.taxRate.create({
        data: {
          businessId: created.id,
          name: "GST 5%",
          cgstBps: 250,
          sgstBps: 250,
          igstBps: 500,
          isDefault: true,
        },
      });
      await tx.taxRate.create({
        data: {
          businessId: created.id,
          name: "GST 12%",
          cgstBps: 600,
          sgstBps: 600,
          igstBps: 1200,
        },
      });
      await tx.taxRate.create({
        data: {
          businessId: created.id,
          name: "GST 18%",
          cgstBps: 900,
          sgstBps: 900,
          igstBps: 1800,
        },
      });
      await tx.cashRegister.create({ data: { branchId: branch.id, name: "Main register" } });
      return created;
    });

    await audit({ businessId: business.id, userId, action: "BUSINESS_CREATED", entity: "Business", entityId: business.id });
    return Response.json({ business });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requirePermission("settings");
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const logo = form.get("logo");
      const upiQr = form.get("upiQr");
      let logoUrl = actor.business.logoUrl;
      let upiQrUrl = actor.business.upiQrUrl;
      if (logo instanceof File && logo.size > 0) logoUrl = await saveImageFile(logo, actor.businessId);
      if (upiQr instanceof File && upiQr.size > 0) upiQrUrl = await saveImageFile(upiQr, actor.businessId);
      const data = Object.fromEntries([...form.entries()].filter(([k]) => k !== "logo" && k !== "upiQr"));
      const business = await prisma.business.update({
        where: { id: actor.businessId },
        data: {
          name: String(data.name ?? actor.business.name),
          address: String(data.address ?? ""),
          city: String(data.city ?? ""),
          state: String(data.state ?? ""),
          pincode: String(data.pincode ?? ""),
          phone: String(data.phone ?? ""),
          gstin: String(data.gstin ?? ""),
          upiId: String(data.upiId ?? actor.business.upiId ?? ""),
          upiMcc: String(data.upiMcc ?? actor.business.upiMcc ?? "0000"),
          upiQrUrl,
          currency: String(data.currency ?? "INR"),
          receiptFooter: String(data.receiptFooter ?? actor.business.receiptFooter),
          returnPolicy: String(data.returnPolicy ?? ""),
          paperWidthMm: Number(data.paperWidthMm ?? 80),
          preventNegativeStock: data.preventNegativeStock === "true",
          pricesTaxInclusive: data.pricesTaxInclusive === "true",
          restaurantEnabled: data.restaurantEnabled === "true",
          hotelEnabled: data.hotelEnabled === "true",
          groceryEnabled: data.groceryEnabled === "true",
          retailEnabled: data.retailEnabled === "true",
          defaultCgstBps: Number(data.defaultCgstBps ?? actor.business.defaultCgstBps),
          defaultSgstBps: Number(data.defaultSgstBps ?? actor.business.defaultSgstBps),
          defaultIgstBps: Number(data.defaultIgstBps ?? actor.business.defaultIgstBps),
          logoUrl,
        },
      });
      return Response.json({ business });
    }
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "Invalid business settings." }, { status: 400 });
    const business = await prisma.business.update({ where: { id: actor.businessId }, data: parsed.data });
    return Response.json({ business });
  } catch (error) {
    return jsonError(error);
  }
}
