import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Aurora restores the active session across storefront pages", async () => {
  const pageNames = ["index.html", "account.html", "checkout.html", "product.html", "ultimi-disponibili.html"];
  const [script, server, ...pages] = await Promise.all([
    readFile("script.js", "utf8"),
    readFile("server.js", "utf8"),
    ...pageNames.map((pageName) => readFile(pageName, "utf8")),
  ]);

  assert.match(script, /const chatHistoryKey = "hallerBoutiqueChatHistory"/);
  assert.match(script, /const chatPanelOpenKey = "hallerBoutiqueChatOpen"/);
  assert.match(script, /const chatDraftKey = "hallerBoutiqueChatDraft"/);
  assert.match(script, /let chatHistory = readStoredChatHistory\(\)/);
  assert.match(script, /storeChatHistory\(chatHistory\)/);
  assert.match(
    script,
    /chatHistory\.forEach\(\(item\) => \{[\s\S]*?appendChatMessage\(messages, item\.role, item\.content\);[\s\S]*?appendChatProductPreviews\(messages, item\.products\)/,
  );
  assert.match(script, /storeChatPanelOpen\(true\)/);
  assert.match(script, /storeChatPanelOpen\(false\)/);
  assert.match(script, /input\.addEventListener\("input", \(\) => storeChatDraft\(input\.value\)\)/);
  assert.match(script, /localStorage\.getItem\(chatPanelOpenKey\) === "1"/);
  assert.match(server, /"\/assets-v\/aurora-voice-2\/script\.js", "\/script\.js"/);
  pages.forEach((page, index) => {
    assert.match(page, /\/assets-v\/aurora-voice-2\/script\.js/, pageNames[index]);
  });
});
