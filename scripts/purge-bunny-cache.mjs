import { execFileSync } from "node:child_process";

const keychainService = "com.hallerboutiique.bunny-api";

function bunnyApiKeyFromKeychain() {
  if (process.platform !== "darwin") return "";
  try {
    return execFileSync(
      "/usr/bin/security",
      ["find-generic-password", "-a", "hallerboutiique", "-s", keychainService, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
  } catch {
    return "";
  }
}

const apiKey = String(process.env.BUNNY_API_KEY || bunnyApiKeyFromKeychain()).trim();
const pullZoneId = String(process.env.BUNNY_PULL_ZONE_ID || "6188330").trim();

if (!apiKey) {
  console.error("Missing Bunny API key. Set BUNNY_API_KEY or add it to the macOS Keychain service com.hallerboutiique.bunny-api.");
  process.exit(1);
}

const response = await fetch(`https://api.bunny.net/pullzone/${encodeURIComponent(pullZoneId)}/purgeCache`, {
  method: "POST",
  headers: {
    AccessKey: apiKey,
    Accept: "application/json",
  },
});

const text = await response.text();
if (!response.ok) {
  console.error(`Bunny purge failed (${response.status}): ${text}`);
  process.exit(1);
}

console.log(`Bunny cache purged for Pull Zone ${pullZoneId}.`);
