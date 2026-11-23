import "server-only";
import ExcelJS from "exceljs";
import { listAllOrders } from "@/lib/shop-orders";
import { orderItemOptions } from "@/lib/models/order";

/** Admin-only Excel export of every shop order, newest first, one row per order. */
export async function buildOrdersXlsx(): Promise<{ buffer: Buffer; fileName: string }> {
  const orders = await listAllOrders();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Orders");
  sheet.columns = [
    { header: "Order", key: "order", width: 12 },
    { header: "Date", key: "date", width: 18 },
    { header: "Status", key: "status", width: 12 },
    { header: "Name", key: "name", width: 22 },
    { header: "Guest", key: "guest", width: 8 },
    { header: "Phone", key: "phone", width: 14 },
    { header: "Email", key: "email", width: 28 },
    { header: "Items", key: "items", width: 48 },
    { header: "Amount (₹)", key: "amount", width: 12 },
    { header: "Payment method", key: "method", width: 14 },
    { header: "Transaction ID", key: "txn", width: 26 },
    { header: "Paid at", key: "paidAt", width: 18 },
    { header: "Address", key: "address", width: 40 },
    { header: "City", key: "city", width: 16 },
    { header: "State", key: "state", width: 16 },
    { header: "Pincode", key: "pincode", width: 10 },
    { header: "Courier", key: "courier", width: 16 },
    { header: "Tracking number", key: "tracking", width: 20 },
    { header: "Cancel reason", key: "cancel", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "";

  for (const o of orders) {
    const row = sheet.addRow({
      order: o.orderNumber,
      date: when(o.createdAt),
      status: o.status,
      name: o.shipTo.name,
      guest: o.guest ? "Yes" : "",
      phone: o.shipTo.phone,
      email: o.shipTo.email,
      items: o.items.map((i) => `${i.qty} × ${i.productTitle} (${orderItemOptions(i)}) @ ₹${i.unitPrice}`).join("\n"),
      amount: o.amount,
      method: o.paymentMethod ?? "",
      txn: o.razorpayPaymentId ?? "",
      paidAt: when(o.paidAt),
      address: o.shipTo.address,
      city: o.shipTo.city,
      state: o.shipTo.state,
      pincode: o.shipTo.pincode,
      courier: o.shipment?.courier ?? "",
      tracking: o.shipment?.trackingNumber ?? "",
      cancel: o.cancelReason ?? "",
    });
    row.getCell("items").alignment = { wrapText: true, vertical: "top" };
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), fileName: `shop-orders-${stamp}.xlsx` };
}
