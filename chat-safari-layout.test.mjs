import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Aurora keeps a scrollable message area and visible composer in Safari", async () => {
  const [script, styles] = await Promise.all([
    readFile("script.js", "utf8"),
    readFile("styles.css", "utf8"),
  ]);

  assert.match(script, /const chatVisibleMessageLimit = 40/);
  assert.match(script, /function scrollChatMessages\(messages\)/);
  assert.match(script, /window\.requestAnimationFrame\(\(\) => \{[\s\S]*?messages\.scrollTop = messages\.scrollHeight/);
  assert.match(script, /function trimVisibleChatMessages\(messages\)/);
  assert.match(script, /while \(messages\.children\.length > chatVisibleMessageLimit\)/);
  assert.match(styles, /\.site-chat-panel\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)[\s\S]*?height:\s*min\(670px, calc\(100vh - 118px\)\)/);
  assert.match(styles, /\.site-chat-conversation\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto auto[\s\S]*?overflow:\s*hidden/);
  assert.match(styles, /\.site-chat-messages\s*\{[\s\S]*?min-height:\s*0[\s\S]*?overflow-y:\s*scroll/);
  assert.match(styles, /\.site-chat-messages::\-webkit-scrollbar/);
});
