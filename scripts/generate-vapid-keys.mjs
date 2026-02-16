import { createPublicKey, generateKeyPairSync } from "node:crypto";

function toBase64Url(input) {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return source
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const { privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});

const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
const publicKeyJwk = createPublicKey(privateKey).export({ format: "jwk" });

if (!publicKeyJwk.x || !publicKeyJwk.y) {
  throw new Error("VAPID 공개키 생성에 실패했습니다.");
}

const uncompressedPublicKey = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(publicKeyJwk.x, "base64url"),
  Buffer.from(publicKeyJwk.y, "base64url"),
]);
const publicKeyBase64Url = toBase64Url(uncompressedPublicKey);

console.log("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=" + publicKeyBase64Url);
console.log("WEB_PUSH_VAPID_PUBLIC_KEY=" + publicKeyBase64Url);
console.log(
  "WEB_PUSH_VAPID_PRIVATE_KEY_PEM=" + String(privateKeyPem).replace(/\n/g, "\\n")
);
console.log("WEB_PUSH_VAPID_SUBJECT=mailto:admin@example.com");

