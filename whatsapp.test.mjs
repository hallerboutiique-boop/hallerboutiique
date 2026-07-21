import assert from "node:assert/strict";
import test from "node:test";
import {
  createWhatsAppOrderNotifier,
  formatWhatsAppOrderMessage,
  normalizeWhatsAppNumber,
} from "./whatsapp.js";

const sampleOrder = {
  orderCode: "HB-20260721-ABC123",
  customer: {
    name: "Mario Rossi",
    phone: "+39 333 123 4567",
    email: "mario@example.com",
    address: "Via Roma 10",
    postalCode: "20100",
    city: "Milano",
  },
  products: [{ name: "Polo Haller", quantity: 2, size: "M", price: "90€" }],
  total: "180,00€",
  paymentMethod: "Contrassegno",
};

test("normalizza il numero italiano nel formato richiesto da WhatsApp", () => {
  assert.equal(normalizeWhatsAppNumber("351 275 7160"), "393512757160");
  assert.equal(normalizeWhatsAppNumber("+39 351 275 7160"), "393512757160");
  assert.equal(normalizeWhatsAppNumber("0039 351 275 7160"), "393512757160");
});

test("crea un riepilogo ordine completo", () => {
  const message = formatWhatsAppOrderMessage(sampleOrder);
  assert.match(message, /HB-20260721-ABC123/);
  assert.match(message, /Mario Rossi/);
  assert.match(message, /2× Polo Haller — taglia M — 90€/);
  assert.match(message, /Via Roma 10, 20100, Milano/);
  assert.match(message, /180,00€/);
});

test("non chiama la rete se le credenziali non sono configurate", async () => {
  let calls = 0;
  const notifier = createWhatsAppOrderNotifier({}, { fetch: async () => { calls += 1; } });
  assert.equal(notifier.configured, false);
  assert.deepEqual(await notifier.send(sampleOrder), { status: "not_configured" });
  assert.equal(calls, 0);
});

test("invia il messaggio al numero amministrativo configurato", async () => {
  let request;
  const notifier = createWhatsAppOrderNotifier({
    accessToken: "test-token",
    phoneNumberId: "123456789",
    recipient: "3512757160",
    apiVersion: "v25.0",
  }, {
    fetch: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ messages: [{ id: "wamid.123" }] }),
      };
    },
  });

  const result = await notifier.send(sampleOrder);
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, "https://graph.facebook.com/v25.0/123456789/messages");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.equal(body.to, "393512757160");
  assert.equal(body.type, "text");
  assert.match(body.text.body, /Polo Haller/);
  assert.deepEqual(result, { status: "sent", messageId: "wamid.123" });
});

test("usa il template approvato quando configurato", async () => {
  let body;
  const notifier = createWhatsAppOrderNotifier({
    accessToken: "test-token",
    phoneNumberId: "123456789",
    recipient: "+39 351 275 7160",
    templateName: "haller_nuovo_ordine",
    templateLanguage: "it",
  }, {
    fetch: async (_url, options) => {
      body = JSON.parse(options.body);
      return { ok: true, status: 200, text: async () => "{}" };
    },
  });

  await notifier.send(sampleOrder);
  assert.equal(body.type, "template");
  assert.equal(body.template.name, "haller_nuovo_ordine");
  assert.equal(body.template.language.code, "it");
  assert.match(body.template.components[0].parameters[0].text, /HB-20260721-ABC123/);
});

test("segnala gli errori restituiti da Meta senza includere il token", async () => {
  const notifier = createWhatsAppOrderNotifier({
    accessToken: "secret-token",
    phoneNumberId: "123456789",
  }, {
    fetch: async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { message: "Template non valido" } }),
    }),
  });

  await assert.rejects(notifier.send(sampleOrder), (error) => {
    assert.match(error.message, /WhatsApp API 400: Template non valido/);
    assert.doesNotMatch(error.message, /secret-token/);
    return true;
  });
});
