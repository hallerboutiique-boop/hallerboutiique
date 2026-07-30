function normalizedName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("it")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function findRegisteredReferrer(users, referralName) {
  const expectedName = normalizedName(referralName);
  if (expectedName.split(" ").filter(Boolean).length < 2) return null;
  const user = (Array.isArray(users) ? users : []).find(
    (entry) => normalizedName(entry?.name) === expectedName && String(entry?.id || "")
  );
  if (!user) return null;
  return {
    id: String(user.id),
    name: String(user.name || "").trim(),
    email: String(user.email || "").trim().toLowerCase(),
    providers: Array.isArray(user.providers) ? user.providers : [user.provider].filter(Boolean),
  };
}
