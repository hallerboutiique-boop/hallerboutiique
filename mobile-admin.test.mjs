import assert from "node:assert/strict";
import test from "node:test";
import {
  ORDER_STATUS,
  buildOrdersDashboard,
  isExpoPushToken,
  normalizePushSubscription,
  publicMobileOrder,
  sendExpoPushNotifications,
  transitionOrder,
} from "./mobile-admin.js";

test("validates and normalizes Expo push subscriptions", () => {
  assert.equal(isExpoPushToken("ExpoPushToken[abc_123-XYZ]"), true);
  assert.equal(isExpoPushToken("not-a-token"), false);
  assert.deepEqual(normalizePushSubscription({
    token: "ExpoPushToken[abc_123-XYZ]",
    platform: "ios",
    deviceName: "iPhone Simone",
  }, "2026-07-21T10:00:00.000Z"), {
    token: "ExpoPushToken[abc_123-XYZ]",
    platform: "ios",
    deviceName: "iPhone Simone",
    appVersion: "",
    updatedAt: "2026-07-21T10:00:00.000Z",
  });
});

test("calculates confirmed revenue separately from pending and rejected orders", () => {
  const dashboard = buildOrdersDashboard([
    { status: "Confermato", totalValue: 120, createdAt: "2026-07-21T08:00:00.000Z" },
    { status: "Nuovo", totalValue: 80, createdAt: "2026-07-21T09:00:00.000Z" },
    { status: "Rifiutato", totalValue: 40, createdAt: "2026-07-20T09:00:00.000Z" },
    { status: "Confermato", totalValue: 30, createdAt: "2026-06-20T09:00:00.000Z" },
  ], new Date("2026-07-21T12:00:00.000Z"));

  assert.equal(dashboard.confirmedRevenue, 150);
  assert.equal(dashboard.pendingRevenue, 80);
  assert.equal(dashboard.todayRevenue, 120);
  assert.equal(dashboard.averageConfirmedOrder, 75);
  assert.deepEqual(dashboard.counts, { all: 4, new: 1, confirmed: 2, rejected: 1 });
});

test("confirms or rejects a new order once", () => {
  const source = { id: "ord_1", status: "Nuovo", products: [], statusHistory: [] };
  const confirmed = transitionOrder(source, ORDER_STATUS.CONFIRMED, "2026-07-21T12:00:00.000Z");
  assert.equal(confirmed.order.status, "Confermato");
  assert.equal(confirmed.inventoryDelta, 0);
  assert.equal(source.status, "Nuovo");

  const rejected = transitionOrder(source, ORDER_STATUS.REJECTED, "2026-07-21T12:00:00.000Z");
  assert.equal(rejected.order.status, "Rifiutato");
  assert.equal(rejected.inventoryDelta, 1);
  assert.throws(() => transitionOrder(confirmed.order, ORDER_STATUS.REJECTED), /gia elaborato/);
});

test("returns only mobile order fields", () => {
  const order = publicMobileOrder({
    id: "ord_1",
    orderCode: "HB-1",
    status: "Nuovo",
    ipAddress: "203.0.113.5",
    customer: { name: "Mario", phone: "+39123" },
    products: [{ name: "Polo", quantity: 1, value: 50 }],
    totalValue: 50,
  });
  assert.equal(order.customer.name, "Mario");
  assert.equal("ipAddress" in order, false);
});

test("sends order pushes and reports stale tokens", async () => {
  const subscriptions = [
    { token: "ExpoPushToken[first]" },
    { token: "ExpoPushToken[second]" },
  ];
  let requestBody;
  const result = await sendExpoPushNotifications({
    subscriptions,
    order: { id: "ord_1", orderCode: "HB-1", total: "90,00€", customer: { name: "Mario" } },
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          data: [
            { status: "ok", id: "ticket_1" },
            { status: "error", details: { error: "DeviceNotRegistered" } },
          ],
        }),
      };
    },
  });
  assert.equal(requestBody[0].data.orderId, "ord_1");
  assert.deepEqual(result, { sent: 1, failed: 1, invalidTokens: ["ExpoPushToken[second]"] });
});
