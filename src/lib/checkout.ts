import { prisma } from "@/lib/prisma";
import { calculateBill, isCashMethod, requiresManualConfirmation, type TaxProfile } from "@/lib/billing";

export type CheckoutPayment = {
  method: string;
  amountPaise: number;
  reference?: string;
  confirmed?: boolean;
  gateway?: string;
  gatewayPaymentId?: string;
};

export type CheckoutItem = {
  productId: string;
  variantId?: string;
  qty: number;
  discountPaise?: number;
  notes?: string;
};

export async function completeCheckout(params: {
  businessId: string;
  branchId: string;
  userId: string;
  customerId?: string | null;
  tableId?: string | null;
  bookingId?: string | null;
  fulfillment?: string;
  notes?: string;
  billDiscountPaise?: number;
  servicePaise?: number;
  deliveryPaise?: number;
  clientNonce: string;
  items: CheckoutItem[];
  payments: CheckoutPayment[];
  sendToKitchen?: boolean;
}) {
  if (!params.clientNonce) throw new Error("Checkout is missing a unique request id.");
  if (!params.items.length) throw new Error("Add at least one item before charging.");

  const existing = await prisma.order.findUnique({
    where: { branchId_clientNonce: { branchId: params.branchId, clientNonce: params.clientNonce } },
    include: { invoice: true, payments: true },
  });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const business = await tx.business.findUniqueOrThrow({ where: { id: params.businessId } });
    if (business.hotelEnabled && !params.customerId) {
      throw new Error("Select a hotel guest before generating the bill.");
    }
    const lines = [];

    for (const item of params.items) {
      if (item.qty <= 0) throw new Error("Quantity must be greater than zero.");
      const product = await tx.product.findFirst({
        where: { id: item.productId, businessId: params.businessId, isActive: true },
        include: { taxRate: true, variants: true, recipeItems: true },
      });
      if (!product) throw new Error("A selected product is unavailable.");
      const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId) : null;
      if (item.variantId && !variant) throw new Error(`Variant missing for ${product.name}.`);

      const unitPaise = variant?.sellingPaise ?? product.sellingPaise;
      const discountPaise = Math.min(product.discountPaise ?? 0, unitPaise) * item.qty;
      const tax: TaxProfile = product.taxRate
        ? {
            cgstBps: product.taxRate.cgstBps,
            sgstBps: product.taxRate.sgstBps,
            igstBps: product.taxRate.igstBps,
            cessBps: product.taxRate.cessBps,
            inclusive: product.taxRate.inclusive,
          }
        : {
            cgstBps: business.defaultCgstBps,
            sgstBps: business.defaultSgstBps,
            igstBps: business.defaultIgstBps,
            cessBps: 0,
            inclusive: business.pricesTaxInclusive,
          };

      if (product.trackStock) {
        if (variant) {
          if (business.preventNegativeStock && variant.stockQty < item.qty) {
            throw new Error(`Insufficient stock for ${product.name} (${variant.name}).`);
          }
        } else {
          const balance = await tx.inventoryBalance.findUnique({
            where: { branchId_productId: { branchId: params.branchId, productId: product.id } },
          });
          const qty = balance?.qty ?? 0;
          if (business.preventNegativeStock && qty < item.qty) {
            throw new Error(`Insufficient stock for ${product.name}.`);
          }
        }
      }

      lines.push({
        product,
        variant,
        qty: item.qty,
        unitPaise,
        discountPaise,
        notes: item.notes,
        tax,
      });
    }

    const bill = calculateBill({
      lines: lines.map((l) => ({
        qty: l.qty,
        unitPaise: l.unitPaise,
        discountPaise: l.discountPaise,
        tax: l.tax,
      })),
      billDiscountPaise: params.billDiscountPaise,
      servicePaise: params.servicePaise,
      deliveryPaise: params.deliveryPaise,
    });
    const taxGroups = new Map<string, { cgstBps: number; sgstBps: number; igstBps: number; cessBps: number; cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number }>();
    lines.forEach((line, index) => {
      const profile = line.tax;
      const key = `${profile.cgstBps}:${profile.sgstBps}:${profile.igstBps}:${profile.cessBps}`;
      const group = taxGroups.get(key) ?? { cgstBps: profile.cgstBps, sgstBps: profile.sgstBps, igstBps: profile.igstBps, cessBps: profile.cessBps, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, cessPaise: 0 };
      group.cgstPaise += bill.lines[index].tax.cgstPaise;
      group.sgstPaise += bill.lines[index].tax.sgstPaise;
      group.igstPaise += bill.lines[index].tax.igstPaise;
      group.cessPaise += bill.lines[index].tax.cessPaise;
      taxGroups.set(key, group);
    });

    const payments = params.payments ?? [];
    if (!payments.length) throw new Error("Choose a payment method.");

    let paidPaise = 0;
    const recordedPayments = [];
    for (const payment of payments) {
      if (payment.amountPaise <= 0) throw new Error("Payment amount must be greater than zero.");
      if (payment.gateway === "RAZORPAY") {
        if (!payment.gatewayPaymentId) {
          throw new Error("Razorpay payment was not verified.");
        }
        recordedPayments.push({
          method: payment.method,
          amountPaise: payment.amountPaise,
          status: "CAPTURED",
          reference: payment.gatewayPaymentId,
          gateway: "RAZORPAY",
          confirmedBy: params.userId,
        });
        paidPaise += payment.amountPaise;
        continue;
      }
      if (isCashMethod(payment.method)) {
        recordedPayments.push({
          method: "CASH",
          amountPaise: payment.amountPaise,
          status: "CAPTURED",
          reference: payment.reference ?? null,
          confirmedBy: params.userId,
        });
        paidPaise += payment.amountPaise;
        continue;
      }
      if (requiresManualConfirmation(payment.method)) {
        if (!payment.confirmed) {
          throw new Error(`Confirm ${payment.method} settlement on the terminal or UPI app before recording it.`);
        }
        recordedPayments.push({
          method: payment.method,
          amountPaise: payment.amountPaise,
          status: "CAPTURED",
          reference: payment.reference ?? null,
          confirmedBy: params.userId,
        });
        paidPaise += payment.amountPaise;
        continue;
      }
      if (payment.method === "CREDIT") {
        if (business.restaurantEnabled || business.hotelEnabled) {
          throw new Error("Customer credit is disabled for restaurant and hotel sales. Collect payment before completing the bill.");
        }
        recordedPayments.push({
          method: "CREDIT",
          amountPaise: payment.amountPaise,
          status: "ON_ACCOUNT",
          reference: payment.reference ?? null,
          confirmedBy: params.userId,
        });
        continue;
      }
      throw new Error(`Unsupported payment method: ${payment.method}`);
    }

    const creditPaise = Math.max(0, bill.totalPaise - paidPaise);
    if ((business.restaurantEnabled || business.hotelEnabled) && creditPaise > 0) {
      throw new Error("Collect the full bill before completing a restaurant or hotel sale.");
    }
    if (creditPaise > 0 && !params.customerId) {
      throw new Error("Outstanding amounts require a customer account.");
    }
    const paymentStatus = creditPaise > 0 ? "PARTIAL" : "PAID";
    const changePaise = Math.max(0, paidPaise - bill.totalPaise);

    const invoiceNumber = `${business.invoicePrefix}-${new Date().getFullYear()}-${String(business.nextInvoiceSeq).padStart(5, "0")}`;
    await tx.business.update({
      where: { id: business.id },
      data: { nextInvoiceSeq: { increment: 1 } },
    });

    const fulfillment = params.fulfillment ?? "WALK_IN";
    const kitchenStatus =
      params.sendToKitchen || (business.restaurantEnabled && fulfillment !== "WALK_IN")
        ? "RECEIVED"
        : "NONE";

    const order = await tx.order.create({
      data: {
        branchId: params.branchId,
        customerId: params.customerId || null,
        cashierId: params.userId,
        tableId: params.tableId || null,
        bookingId: params.bookingId || null,
        invoiceNumber,
        status: "COMPLETED",
        fulfillment,
        kitchenStatus,
        notes: params.notes,
        subtotalPaise: bill.subtotalPaise,
        itemDiscountPaise: bill.itemDiscountPaise,
        billDiscountPaise: bill.billDiscountPaise,
        servicePaise: bill.servicePaise,
        deliveryPaise: bill.deliveryPaise,
        taxPaise: bill.tax.taxPaise,
        roundOffPaise: bill.roundOffPaise,
        totalPaise: bill.totalPaise,
        paidPaise: Math.min(paidPaise, bill.totalPaise),
        changePaise,
        paymentStatus,
        clientNonce: params.clientNonce,
        completedAt: new Date(),
        items: {
          create: lines.map((line, index) => ({
            productId: line.product.id,
            variantId: line.variant?.id,
            name: line.variant ? `${line.product.name} · ${line.variant.name}` : line.product.name,
            qty: line.qty,
            unitPaise: line.unitPaise,
            discountPaise: line.discountPaise,
            taxPaise: bill.lines[index].tax.taxPaise,
            linePaise: bill.lines[index].linePaise,
            notes: line.notes,
          })),
        },
        payments: {
          create: recordedPayments,
        },
      },
    });

    await tx.invoice.create({
      data: {
        orderId: order.id,
        number: invoiceNumber,
        snapshotJson: JSON.stringify({
          business: {
            name: business.name,
            address: business.address,
            city: business.city,
            state: business.state,
            pincode: business.pincode,
            phone: business.phone,
            gstin: business.gstin,
            logoUrl: business.logoUrl,
            footer: business.receiptFooter,
            returnPolicy: business.returnPolicy,
            paperWidthMm: business.paperWidthMm,
          },
          invoiceNumber,
          tax: bill.tax,
          taxBreakdown: [...taxGroups.values()],
          totalPaise: bill.totalPaise,
        }),
      },
    });

    for (const line of lines) {
      const deduct = async (productId: string, qty: number, reason: string) => {
        const current = await tx.inventoryBalance.findUnique({
          where: { branchId_productId: { branchId: params.branchId, productId } },
        });
        const nextQty = (current?.qty ?? 0) - qty;
        if (current) {
          await tx.inventoryBalance.update({
            where: { id: current.id },
            data: { qty: nextQty },
          });
        } else {
          await tx.inventoryBalance.create({
            data: { branchId: params.branchId, productId, qty: nextQty },
          });
        }
        await tx.stockMovement.create({
          data: {
            branchId: params.branchId,
            productId,
            qtyDelta: -qty,
            reason,
            refType: "ORDER",
            refId: order.id,
            createdBy: params.userId,
          },
        });
      };

      if (line.variant) {
        await tx.productVariant.update({
          where: { id: line.variant.id },
          data: { stockQty: { decrement: line.qty } },
        });
      }
      if (line.product.recipeItems.length) {
        for (const ingredient of line.product.recipeItems) {
          await deduct(ingredient.ingredientId, ingredient.qty * line.qty, "RECIPE_CONSUMPTION");
        }
      } else if (line.product.trackStock) {
        await deduct(line.product.id, line.qty, "SALE");
      }
    }

    if (creditPaise > 0 && params.customerId) {
      await tx.customer.update({
        where: { id: params.customerId },
        data: { outstandingPaise: { increment: creditPaise } },
      });
    }

    if (params.tableId) {
      await tx.restaurantTable.update({
        where: { id: params.tableId },
        data: { status: "AWAITING_CLEANING" },
      });
    }

    if (kitchenStatus === "RECEIVED") {
      await tx.kitchenTicket.create({
        data: {
          orderId: order.id,
          station: "MAIN",
          status: "RECEIVED",
          itemsJson: JSON.stringify(
            lines.map((l) => ({
              name: l.variant ? `${l.product.name} · ${l.variant.name}` : l.product.name,
              qty: l.qty,
              notes: l.notes,
            })),
          ),
        },
      });
    }

    const openShift = await tx.registerShift.findFirst({
      where: { register: { branchId: params.branchId }, closedAt: null },
    });
    if (openShift) {
      const cash = recordedPayments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amountPaise, 0);
      const other = recordedPayments.filter((p) => p.method !== "CASH").reduce((s, p) => s + p.amountPaise, 0);
      await tx.registerShift.update({
        where: { id: openShift.id },
        data: {
          cashSalesPaise: { increment: cash },
          otherSalesPaise: { increment: other },
          expectedPaise: { increment: cash },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        businessId: params.businessId,
        userId: params.userId,
        action: "SALE_COMPLETED",
        entity: "Order",
        entityId: order.id,
        payload: JSON.stringify({ invoiceNumber, totalPaise: bill.totalPaise }),
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { invoice: true, payments: true, items: true, customer: true },
    });
  }, { maxWait: 10_000, timeout: 30_000 });
}
