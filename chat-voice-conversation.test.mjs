import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("Aurora supports continuous voice conversation with animated feedback", async () => {
  const [script, styles, server, smile, talkSmall, talkWide, blink] = await Promise.all([
    readFile("script.js", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("server.js", "utf8"),
    stat("assets/chat-assistant-avatar-live-smile.jpg"),
    stat("assets/chat-assistant-avatar-live-talk-small.jpg"),
    stat("assets/chat-assistant-avatar-live-talk-wide.jpg"),
    stat("assets/chat-assistant-avatar-live-blink.jpg"),
  ]);

  [smile, talkSmall, talkWide, blink].forEach((frame) => assert.ok(frame.size > 20_000));
  assert.match(script, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(script, /voiceRecognition\.continuous = false/);
  assert.match(script, /voiceRecognition\.interimResults = true/);
  assert.match(script, /fetch\("\/api\/chat\/speech"/);
  assert.match(script, /await playAuroraSpeech\(data\.reply\)/);
  assert.match(script, /new window\.SpeechSynthesisUtterance\(text\)/);
  assert.match(script, /utterance\.rate = 0\.9/);
  assert.match(script, /window\.setTimeout\(startVoiceListening, 350\)/);
  assert.match(script, /\/assets\/chat-assistant-avatar-live-smile\.jpg/);
  assert.match(script, /data-chat-face-frame="talk-small"/);
  assert.match(script, /data-chat-face-frame="talk-wide"/);
  assert.match(script, /data-chat-face-frame="blink"/);
  assert.match(script, /createMediaElementSource\(audio\)/);
  assert.match(script, /getByteTimeDomainData\(auroraAudioSamples\)/);
  assert.match(script, /window\.requestAnimationFrame\(renderFrame\)/);
  assert.match(script, /data-chat-voice-stage/);
  assert.match(script, /Voce generata con AI/);

  assert.match(styles, /\.site-chat-voice-stage\.is-speaking \.site-chat-voice-portrait/);
  assert.match(styles, /@keyframes aurora-speaking/);
  assert.match(styles, /@keyframes aurora-body-idle/);
  assert.match(styles, /@keyframes aurora-torso-breath/);
  assert.match(styles, /@keyframes aurora-torso-speaking/);
  assert.match(styles, /@keyframes aurora-voice-ring/);
  assert.match(styles, /@keyframes aurora-voice-wave/);

  assert.match(server, /OPENAI_TTS_MODEL \|\| "gpt-4o-mini-tts"/);
  assert.match(server, /OPENAI_TTS_VOICE \|\| "shimmer"/);
  assert.match(server, /https:\/\/api\.openai\.com\/v1\/audio\/speech/);
  assert.match(server, /instructions: auroraSpeechInstructions\[language\]/);
  assert.match(server, /speed: 0\.91/);
  assert.match(server, /function canRequestAuroraSpeech\(ip\)/);
  assert.match(server, /url\.pathname === "\/api\/chat\/speech"/);
  assert.match(server, /"Content-Type": "audio\/mpeg"/);
});

test("all customer pages load the versioned Aurora voice assets", async () => {
  const pageNames = ["index.html", "account.html", "checkout.html", "product.html", "ultimi-disponibili.html"];
  const pages = await Promise.all(pageNames.map((pageName) => readFile(pageName, "utf8")));

  pages.forEach((page, index) => {
    assert.match(page, /\/assets-v\/aurora-live-2\/script\.js/, pageNames[index]);
    assert.match(page, /\/assets-v\/aurora-live-2\/styles\.css/, pageNames[index]);
  });
});
