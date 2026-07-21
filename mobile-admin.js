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
