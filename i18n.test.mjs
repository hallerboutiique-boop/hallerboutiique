import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlFiles = ["index.html", "account.html", "checkout.html", "spedizioni.html", "termini.html", "privacy.html", "admin.html"];

test("one language controller owns every picker", async () => {
  const [i18n, script] = await Promise.all([readFile("i18n.js", "utf8"), readFile("script.js", "utf8")]);
  assert.match(i18n, /picker\.dataset\.i18nBound = "true"/);
  assert.match(script, /window\.addEventListener\("haller-language-change"/);
  assert.doesNotMatch(script, /languageToggle\.addEventListener/);
});

test("Aurora sends and enforces the selected language", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.match(script, /language: siteLanguage/);
  assert.match(server, /const siteChatLanguages = \{/);
  assert.match(server, /Rispondi esclusivamente in \$\{languageConfig\.name\}/);
  assert.doesNotMatch(server, /Scrivi in italiano, con tono caldo/);
  for (const language of ["it", "en", "fr", "de", "es"]) {
    assert.match(server, new RegExp(`\\n  ${language}: \\{ name:`));
  }
});

test("action-only UI and try-on use the selected language", async () => {
  const [script, server] = await Promise.all([readFile("script.js", "utf8"), readFile("server.js", "utf8")]);
  assert.match(script, /formData\.append\("language", siteLanguage\)/);
  assert.match(script, /translate\("location-authorize"\)/);
  assert.match(script, /translate\("confirming-order"\)/);
  assert.match(server, /const tryOnLanguages = \{/);
});

test("all pages use the cache-busted unified language script", async () => {
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    assert.match(html, /i18n\.js\?v=sitewide-language-5/, file);
    assert.doesNotMatch(html, /sitewide-language-[1234]/, file);
  }
});
