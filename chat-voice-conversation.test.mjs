import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("Aurora supports continuous voice conversation with animated feedback", async () => {
  const [script, styles, server, avatar] = await Promise.all([
    readFile("script.js", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("server.js", "utf8"),
    stat("assets/chat-assistant-avatar-voice.jpg"),
  ]);

  assert.ok(avatar.size > 20_000);
  assert.match(script, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(script, /voiceRecognition\.continuous = false/);
  assert.match(script, /voiceRecognition\.interimResults = true/);
  assert.match(script, /fetch\("\/api\/chat\/speech"/);
  assert.match(script, /await playAuroraSpeech\(data\.reply\)/);
  assert.match(script, /new window\.SpeechSynthesisUtterance\(text\)/);
  assert.match(script, /utterance\.rate = 0\.92/);
  assert.match(script, /window\.setTimeout\(startVoiceListening, 350\)/);
  assert.match(script, /\/assets\/chat-assistant-avatar-voice\.jpg/);
  assert.match(script, /data-chat-voice-stage/);
  assert.match(script, /Voce generata con AI/);

  assert.match(styles, /\.site-chat-voice-stage\.is-speaking \.site-chat-voice-avatar img/);
  assert.match(styles, /@keyframes aurora-speaking/);
  assert.match(styles, /@keyframes aurora-voice-ring/);
  assert.match(styles, /@keyframes aurora-voice-wave/);

  assert.match(server, /OPENAI_TTS_MODEL \|\| "gpt-4o-mini-tts"/);
  assert.match(server, /OPENAI_TTS_VOICE \|\| "marin"/);
  assert.match(server, /https:\/\/api\.openai\.com\/v1\/audio\/speech/);
  assert.match(server, /instructions: auroraSpeechInstructions\[language\]/);
  assert.match(server, /function canRequestAuroraSpeech\(ip\)/);
  assert.match(server, /url\.pathname === "\/api\/chat\/speech"/);
  assert.match(server, /"Content-Type": "audio\/mpeg"/);
});

test("all customer pages load the versioned Aurora voice assets", async () => {
  const pageNames = ["index.html", "account.html", "checkout.html", "product.html", "ultimi-disponibili.html"];
  const pages = await Promise.all(pageNames.map((pageName) => readFile(pageName, "utf8")));

  pages.forEach((page, index) => {
    assert.match(page, /\/assets-v\/aurora-voice-2\/script\.js/, pageNames[index]);
    assert.match(page, /\/assets-v\/aurora-voice-2\/styles\.css/, pageNames[index]);
  });
});
