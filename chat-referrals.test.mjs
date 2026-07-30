import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { findRegisteredReferrer } from "./chat-referrals.mjs";

test("matches a registered referrer independently of direct or social sign-in", () => {
  const users = [
    { id: "usr_email", name: "Maria D'Angelo", email: "maria@example.com", provider: "email" },
    { id: "usr_google", name: "Luca Rossi", email: "luca@example.com", providers: ["google", "microsoft"] },
  ];

  assert.deepEqual(findRegisteredReferrer(users, "maria d angelo"), {
    id: "usr_email",
    name: "Maria D'Angelo",
    email: "maria@example.com",
    providers: ["email"],
  });
  assert.equal(findRegisteredReferrer(users, "Luca Bianchi"), null);
  assert.equal(findRegisteredReferrer(users, "Maria"), null);
});

test("chat limits client context and verifies registered referrers server-side", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);

  assert.match(script, /const chatHistoryLimit = 8/);
  assert.match(script, /history: chatHistory\.slice\(0, -1\)\.slice\(-chatHistoryLimit\)/);
  assert.match(script, /AbortController/);
  assert.doesNotMatch(script, /catalog: getChatCatalog\(\)/);
  assert.match(server, /findRegisteredReferrer/);
  assert.match(server, /const referralUser = findRegisteredReferrer\(await readUsers\(\), referralName\)/);
  assert.match(server, /referrerUserId: referralUser\.id/);
  assert.match(server, /referrerEmail: referralUser\.email/);
});
