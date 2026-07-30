import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Aurora returns and renders previews for cited catalog products", async () => {
  const [server, script, styles] = await Promise.all([
    readFile("server.js", "utf8"),
    readFile("script.js", "utf8"),
    readFile("styles.css", "utf8"),
  ]);

  assert.match(server, /required: \["reply", "productIds", "checkout"\]/);
  assert.match(server, /function chatProductPreviews\(productIds, reply, catalog\)/);
  assert.match(server, /image: cleanProductImages\(product\?\.images\)\[0\] \|\| ""/);
  assert.match(server, /Ogni volta che citi, mostri o consigli uno o piu prodotti/);
  assert.match(server, /const products = chatProductPreviews\(response\.productIds, reply, catalog\)/);
  assert.match(server, /json\(res, 200, \{ ok: true, reply, products, checkout, language \}\)/);
  assert.match(script, /function cleanChatPreviewProducts\(products\)/);
  assert.match(script, /function appendChatProductPreviews\(messages, products\)/);
  assert.match(script, /product\.html\?id=\$\{encodeURIComponent\(product\.id\)\}/);
  assert.match(script, /appendChatProductPreviews\(messages, previewProducts\)/);
  assert.match(script, /rememberChatMessage\("assistant", data\.reply, previewProducts\)/);
  assert.match(styles, /\.site-chat-product-previews/);
  assert.match(styles, /\.site-chat-product-card/);
  assert.match(styles, /\.site-chat-product-media img/);
});
