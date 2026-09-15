// Formal validation only. A valid checksum does not prove registration or ownership.
export function normalizeSwedishOrgNumber(value) {
  const text = String(value ?? "").trim();
  if (!/^(?:16)?\d{6}[- ]?\d{4}$/.test(text)) return null;
  const digits = text.replace(/[- ]/g, "").replace(/^16(?=\d{10}$)/, "");
  if (digits.length !== 10 || Number(digits[2]) < 2 || /^0+$/.test(digits)) return null;
  const sum = [...digits].reduce((total, character, index) => {
    const product = Number(character) * (index % 2 === 0 ? 2 : 1);
    return total + Math.floor(product / 10) + product % 10;
  }, 0);
  return sum % 10 === 0 ? digits : null;
}

export async function verifyCompanyRegistration(value, officialLookup) {
  const orgNo = normalizeSwedishOrgNumber(value);
  if (!orgNo) return { status: "invalid", orgNo: null };
  if (typeof officialLookup !== "function") return { status: "not_configured", orgNo };
  const result = await officialLookup(orgNo);
  if (result?.registered === true && result?.sourceUrl) return { status: "registered", orgNo, sourceUrl: result.sourceUrl };
  if (result?.registered === false && result?.sourceUrl) return { status: "not_registered", orgNo, sourceUrl: result.sourceUrl };
  return { status: "unverified", orgNo };
}
