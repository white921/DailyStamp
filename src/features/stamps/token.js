import crypto from "node:crypto";

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createLinkToken({ userId, secret, expiresInHours = 24 }) {
  const payload = JSON.stringify({
    userId,
    exp: Date.now() + expiresInHours * 60 * 60 * 1000,
  });

  const encodedPayload = toBase64Url(payload);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyLinkToken(token, secret) {
  if (!token || !token.includes(".")) {
    throw new Error("Invalid token format");
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(fromBase64Url(encodedPayload));

  if (payload.exp < Date.now()) {
    throw new Error("Token expired");
  }

  return payload;
}
