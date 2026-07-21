const expoPushEndpoint = "https://exp.host/--/api/v2/push/send";

export const ORDER_STATUS = Object.freeze({
  NEW: "Nuovo",
  CONFIRMED: "Confermato",
  REJECTED: "Rifiutato",
});

const allowedOrderStatuses = new Set(Object.values(ORDER_STATUS));

function finiteMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function monthKey(value) {
  return dateKey(value).slice(0, 7);
}

function labelText(value, maxLength = 180) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function escapeLabelHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function isExpoPushToken(value) {
  return /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(String(value || "").trim());
}

export function normalizePushSubscription(input, now = new Date().toISOString()) {
  const token = String(input?.token || "").trim();
  if (!isExpoPushToken(token)) return null;
  const platform = input?.platform === "ios" ? "ios" : input?.platform === "android" ? "android" : "unknown";
  return {
    token,
    platform,
    deviceName: String(input?.deviceName || "").trim().slice(0, 100),
    appVersion: String(input?.appVersion || "").trim().slice(0, 40),
    updatedAt: now,
  };
}

export function publicMobileOrder(order) {
  const products = Array.isArray(order?.products) ? order.products : [];
  return {
    id: String(order?.id || ""),
    orderCode: String(order?.orderCode || ""),
    createdAt: String(order?.createdAt || ""),
    status: allowedOrderStatuses.has(order?.status) ? order.status : ORDER_STATUS.NEW,
    statusUpdatedAt: String(order?.statusUpdatedAt || order?.createdAt || ""),
    statusHistory: Array.isArray(order?.statusHistory)
      ? order.statusHistory.map((entry) => ({
          status: allowedOrderStatuses.has(entry?.status) ? entry.status : ORDER_STATUS.NEW,
          at: String(entry?.at || ""),
        }))
      : [],
    customer: {
      name: String(order?.customer?.name || ""),
      email: String(order?.customer?.email || ""),
      phone: String(order?.customer?.phone || ""),
      address: String(order?.customer?.address || ""),
      city: String(order?.customer?.city || ""),
      postalCode: String(order?.customer?.postalCode || ""),
    },
    paymentMethod: String(order?.paymentMethod || ""),
    txHash: String(order?.txHash || ""),
    discountCode: String(order?.discountCode || ""),
    products: products.map((product) => ({
      id: String(product?.id || ""),
      name: String(product?.name || "Prodotto"),
      price: String(product?.price || ""),
      size: String(product?.size || ""),
      quantity: Math.max(1, Number.parseInt(product?.quantity || 1, 10) || 1),
      value: finiteMoney(product?.value),
    })),
    totalValue: finiteMoney(order?.totalValue),
    total: String(order?.total || ""),
  };
}

export function buildShippingLabel(order, generatedAt = new Date().toISOString()) {
  const mobileOrder = publicMobileOrder(order);
  if (mobileOrder.status !== ORDER_STATUS.CONFIRMED) {
    const error = new Error("Conferma l'ordine prima di generare l'etichetta.");
    error.code = "ORDER_NOT_CONFIRMED";
    throw error;
  }

  const itemCount = mobileOrder.products.reduce((sum, product) => sum + product.quantity, 0);
  return {
    version: 1,
    generatedAt,
    orderId: labelText(mobileOrder.id, 100),
    orderCode: labelText(mobileOrder.orderCode || mobileOrder.id, 80),
    sender: {
      name: "Haller Boutique",
      address: "Via Fabio Filzi 7",
      postalCode: "20124",
      city: "Milano",
      country: "Italia",
      phone: "3447873142",
      website: "hallerboutiique.com",
    },
    recipient: {
      name: labelText(mobileOrder.customer.name || "Cliente", 120),
      address: labelText(mobileOrder.customer.address, 180),
      postalCode: labelText(mobileOrder.customer.postalCode, 20),
      city: labelText(mobileOrder.customer.city, 80),
      country: "Italia",
      phone: labelText(mobileOrder.customer.phone, 60),
      email: labelText(mobileOrder.customer.email, 180),
    },
    parcel: {
      packages: 1,
      itemCount,
    },
  };
}

export function shippingLabelQrPayload(label) {
  return JSON.stringify({
    v: 1,
    ordine: label.orderCode,
    mittente: {
      nome: label.sender.name,
      indirizzo: label.sender.address,
      cap: label.sender.postalCode,
      citta: label.sender.city,
      paese: label.sender.country,
      telefono: label.sender.phone,
    },
    destinatario: label.recipient.name,
    indirizzo: label.recipient.address,
    cap: label.recipient.postalCode,
    citta: label.recipient.city,
    paese: label.recipient.country,
    telefono: label.recipient.phone,
    email: label.recipient.email,
    colli: label.parcel.packages,
  });
}

export function renderShippingLabelHtml(label, qrCodeDataUrl) {
  const sender = label.sender;
  const recipient = label.recipient;
  const qr = escapeLabelHtml(qrCodeDataUrl);
  const recipientLocality = [recipient.postalCode, recipient.city].filter(Boolean).join(" ");
  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @page { size: 100mm 150mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100mm; height: 150mm; background: #fff; color: #000; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; }
    .label { width: 100mm; min-height: 150mm; padding: 6mm; border: 0.5mm solid #000; display: flex; flex-direction: column; }
    .top { display: flex; justify-content: space-between; gap: 4mm; border-bottom: 0.6mm solid #000; padding-bottom: 4mm; }
    .eyebrow { font-size: 7.5pt; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    .sender { font-size: 8.5pt; line-height: 1.35; margin-top: 1.5mm; }
    .code { text-align: right; font-size: 9pt; }
    .code strong { display: block; font-size: 16pt; margin-top: 1mm; overflow-wrap: anywhere; }
    .destination { padding: 6mm 0 5mm; border-bottom: 0.6mm solid #000; }
    .name { font-size: 19pt; line-height: 1.05; font-weight: 900; margin: 2.5mm 0 4mm; overflow-wrap: anywhere; }
    .address { font-size: 14pt; line-height: 1.25; font-weight: 750; overflow-wrap: anywhere; }
    .contact { margin-top: 4mm; font-size: 9pt; line-height: 1.45; overflow-wrap: anywhere; }
    .bottom { display: grid; grid-template-columns: 1fr 35mm; gap: 5mm; align-items: end; padding-top: 5mm; flex: 1; }
    .meta { align-self: stretch; display: flex; flex-direction: column; justify-content: space-between; }
    .parcel { border: 0.45mm solid #000; padding: 3mm; font-size: 10pt; line-height: 1.5; }
    .notice { font-size: 7.5pt; line-height: 1.35; color: #333; }
    .qr { width: 35mm; height: 35mm; object-fit: contain; image-rendering: crisp-edges; }
  </style>
</head>
<body>
  <main class="label">
    <section class="top">
      <div>
        <div class="eyebrow">Mittente</div>
        <div class="sender"><strong>${escapeLabelHtml(sender.name)}</strong><br>${escapeLabelHtml(sender.address)}<br>${escapeLabelHtml(`${sender.postalCode} ${sender.city}`)} · ${escapeLabelHtml(sender.country)}<br>Tel. ${escapeLabelHtml(sender.phone)} · ${escapeLabelHtml(sender.website)}</div>
      </div>
      <div class="code"><span class="eyebrow">Ordine</span><strong>${escapeLabelHtml(label.orderCode)}</strong></div>
    </section>
    <section class="destination">
      <div class="eyebrow">Destinatario</div>
      <div class="name">${escapeLabelHtml(recipient.name)}</div>
      <div class="address">${escapeLabelHtml(recipient.address)}<br>${escapeLabelHtml(recipientLocality)}<br>${escapeLabelHtml(recipient.country)}</div>
      <div class="contact">${recipient.phone ? `Tel. ${escapeLabelHtml(recipient.phone)}` : ""}${recipient.phone && recipient.email ? "<br>" : ""}${recipient.email ? escapeLabelHtml(recipient.email) : ""}</div>
    </section>
    <section class="bottom">
      <div class="meta">
        <div class="parcel"><strong>COLLI:</strong> ${escapeLabelHtml(label.parcel.packages)}<br><strong>ARTICOLI:</strong> ${escapeLabelHtml(label.parcel.itemCount)}</div>
        <div class="notice">Etichetta logistica interna. Il QR contiene i dati necessari alla spedizione e il numero ordine.</div>
      </div>
      <img class="qr" src="${qr}" alt="QR dati spedizione">
    </section>
  </main>
</body>
</html>`;
}

export function transitionOrder(order, targetStatus, now = new Date().toISOString()) {
  if (!allowedOrderStatuses.has(targetStatus) || targetStatus === ORDER_STATUS.NEW) {
    const error = new Error("Stato ordine non valido.");
    error.code = "INVALID_STATUS";
    throw error;
  }

  const currentStatus = allowedOrderStatuses.has(order?.status) ? order.status : ORDER_STATUS.NEW;
  if (currentStatus === targetStatus) return { order: structuredClone(order), changed: false, inventoryDelta: 0 };
  if (currentStatus !== ORDER_STATUS.NEW) {
    const error = new Error("Un ordine gia elaborato non puo essere modificato.");
    error.code = "INVALID_TRANSITION";
    throw error;
  }

  const nextOrder = structuredClone(order);
  nextOrder.status = targetStatus;
  nextOrder.statusUpdatedAt = now;
  nextOrder.statusHistory = Array.isArray(nextOrder.statusHistory) ? nextOrder.statusHistory : [];
  nextOrder.statusHistory.push({ status: targetStatus, at: now });
  return {
    order: nextOrder,
    changed: true,
    inventoryDelta: targetStatus === ORDER_STATUS.REJECTED ? 1 : 0,
  };
}

export function buildOrdersDashboard(orders, now = new Date()) {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const today = dateKey(now);
  const monthlyRevenue = new Map();
  let confirmedRevenue = 0;
  let pendingRevenue = 0;
  let todayRevenue = 0;
  let confirmedCount = 0;
  let newCount = 0;
  let rejectedCount = 0;

  for (const order of safeOrders) {
    const total = finiteMoney(order?.totalValue);
    const status = allowedOrderStatuses.has(order?.status) ? order.status : ORDER_STATUS.NEW;
    if (status === ORDER_STATUS.CONFIRMED) {
      confirmedRevenue += total;
      confirmedCount += 1;
      if (dateKey(order?.createdAt) === today) todayRevenue += total;
      const month = monthKey(order?.createdAt);
      if (month) monthlyRevenue.set(month, finiteMoney((monthlyRevenue.get(month) || 0) + total));
    } else if (status === ORDER_STATUS.REJECTED) {
      rejectedCount += 1;
    } else {
      newCount += 1;
      pendingRevenue += total;
    }
  }

  return {
    generatedAt: now.toISOString(),
    confirmedRevenue: finiteMoney(confirmedRevenue),
    pendingRevenue: finiteMoney(pendingRevenue),
    todayRevenue: finiteMoney(todayRevenue),
    averageConfirmedOrder: confirmedCount ? finiteMoney(confirmedRevenue / confirmedCount) : 0,
    counts: {
      all: safeOrders.length,
      new: newCount,
      confirmed: confirmedCount,
      rejected: rejectedCount,
    },
    monthlyRevenue: [...monthlyRevenue.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-6)
      .map(([month, revenue]) => ({ month, revenue })),
  };
}

export function newOrderPushMessage(subscription, order) {
  const customer = String(order?.customer?.name || "Cliente").trim() || "Cliente";
  const code = String(order?.orderCode || "Nuovo ordine");
  const total = String(order?.total || "");
  return {
    to: subscription.token,
    sound: "default",
    title: `Nuovo ordine ${code}`,
    body: [customer, total].filter(Boolean).join(" · "),
    data: { type: "new_order", orderId: String(order?.id || "") },
    priority: "high",
    channelId: "orders",
  };
}

export async function sendExpoPushNotifications({ subscriptions, order, fetchImpl = fetch }) {
  const validSubscriptions = (Array.isArray(subscriptions) ? subscriptions : []).filter((entry) => isExpoPushToken(entry?.token));
  if (!validSubscriptions.length) return { sent: 0, failed: 0, invalidTokens: [] };

  let sent = 0;
  let failed = 0;
  const invalidTokens = [];

  for (let offset = 0; offset < validSubscriptions.length; offset += 100) {
    const batch = validSubscriptions.slice(offset, offset + 100);
    const response = await fetchImpl(expoPushEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch.map((subscription) => newOrderPushMessage(subscription, order))),
    });
    if (!response.ok) throw new Error(`Expo Push HTTP ${response.status}`);
    const payload = await response.json();
    const receipts = Array.isArray(payload?.data) ? payload.data : [payload?.data].filter(Boolean);
    receipts.forEach((receipt, index) => {
      if (receipt?.status === "ok") {
        sent += 1;
        return;
      }
      failed += 1;
      if (receipt?.details?.error === "DeviceNotRegistered" && batch[index]?.token) {
        invalidTokens.push(batch[index].token);
      }
    });
  }

  return { sent, failed, invalidTokens };
}
