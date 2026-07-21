const defaultGraphApiVersion = "v25.0";
const defaultRecipient = "393512757160";
const maxMessageLength = 4000;

export function normalizeWhatsAppNumber(value, fallback = "") {
  let digits = String(value || fallback).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("3")) digits = `39${digits}`;
  return digits;
}

function cleanMessageValue(value, fallback = "Non indicato") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function productLine(product) {
  const quantity = Math.max(1, Number.parseInt(product?.quantity || 1, 10) || 1);
  const name = cleanMessageValue(product?.name, "Prodotto").slice(0, 140);
  const details = [];
  if (product?.size) details.push(`taglia ${cleanMessageValue(product.size).slice(0, 30)}`);
  if (product?.price) details.push(cleanMessageValue(product.price).slice(0, 30));
  return `• ${quantity}× ${name}${details.length ? ` — ${details.join(" — ")}` : ""}`;
}

export function formatWhatsAppOrderMessage(order) {
  const customer = order?.customer || {};
  const products = Array.isArray(order?.products) && order.products.length
    ? order.products.map(productLine)
    : ["• Prodotti non indicati"];
  const address = [customer.address, customer.postalCode, customer.city]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
  const optional = [];
  if (order?.discountCode) optional.push(`Sconto: ${cleanMessageValue(order.discountCode)}`);
  if (order?.txHash) optional.push(`TX hash: ${cleanMessageValue(order.txHash).slice(0, 180)}`);

  const message = [
    "🛍️ *Nuovo ordine Haller Boutique*",
    `Codice: *${cleanMessageValue(order?.orderCode)}*`,
    "",
    `Cliente: ${cleanMessageValue(customer.name)}`,
    `Telefono: ${cleanMessageValue(customer.phone)}`,
    `Email: ${cleanMessageValue(customer.email)}`,
    "",
    "Articoli:",
    ...products,
    "",
    `Totale: *${cleanMessageValue(order?.total)}*`,
    `Pagamento: ${cleanMessageValue(order?.paymentMethod)}`,
    `Consegna: ${cleanMessageValue(address)}`,
    ...optional,
  ].join("\n");

  return message.length <= maxMessageLength
    ? message
    : `${message.slice(0, maxMessageLength - 20).trimEnd()}\n…dati abbreviati`;
}

function graphApiVersion(value) {
  const version = String(value || defaultGraphApiVersion).trim();
  return /^v\d+\.\d+$/.test(version) ? version : defaultGraphApiVersion;
}

function buildMessagePayload(order, recipient, templateName, templateLanguage) {
  const message = formatWhatsAppOrderMessage(order);
  if (templateName) {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLanguage || "it" },
        components: [{
          type: "body",
          parameters: [{ type: "text", text: message }],
        }],
      },
    };
  }

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "text",
    text: { preview_url: false, body: message },
  };
}

export function createWhatsAppOrderNotifier(config = {}, dependencies = {}) {
  const accessToken = String(config.accessToken || "").trim();
  const phoneNumberId = String(config.phoneNumberId || "").replace(/\D/g, "");
  const recipient = normalizeWhatsAppNumber(config.recipient, defaultRecipient);
  const templateName = String(config.templateName || "").trim();
  const templateLanguage = String(config.templateLanguage || "it").trim();
  const apiVersion = graphApiVersion(config.apiVersion);
  const timeoutMs = Math.max(1000, Math.min(30000, Number(config.timeoutMs || 8000)));
  const fetchImpl = dependencies.fetch || globalThis.fetch;
  const configured = Boolean(accessToken && phoneNumberId && recipient && fetchImpl);

  return {
    configured,
    recipient,
    async send(order) {
      if (!configured) return { status: "not_configured" };

      const response = await fetchImpl(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildMessagePayload(order, recipient, templateName, templateLanguage)),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const raw = await response.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!response.ok) {
        const apiMessage = cleanMessageValue(data?.error?.message || raw, "Errore WhatsApp").slice(0, 300);
        throw new Error(`WhatsApp API ${response.status}: ${apiMessage}`);
      }

      return {
        status: "sent",
        messageId: cleanMessageValue(data?.messages?.[0]?.id, "").slice(0, 180),
      };
    },
  };
}
