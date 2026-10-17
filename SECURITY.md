# Security Policy & Vulnerability Disclosure

**ClipSync PRO** is built from the ground up with **zero-knowledge client-side cryptography** and **WebRTC peer-to-peer streaming**. We treat data confidentiality, integrity, and privacy as critical core principles.

---

## 🔒 Cryptographic Architecture & Guarantees

1. **Client-Side AES-GCM-256:** All payload encryption occurs locally in your device's browser using the native Web Crypto API (`crypto.subtle`). Keys are derived using PBKDF2 with 100,000 SHA-256 iterations and unique 16-byte cryptographic salts.
2. **Direct WebRTC P2P Data Channels:** When paired via live QR code or 6-digit code, files and large streams transfer directly peer-to-peer over DTLS-encrypted SCTP channels. No intermediate cloud servers ever receive or store your files.
3. **Zero-Knowledge Cloud Fallback:** When cloud relay is used, the server only receives encrypted ciphertext blobs. The decryption key never leaves the client devices.
4. **Automated Burn-on-Read:** Ephemeral payloads automatically self-destruct upon retrieval or when the expiry timer elapses.

---

## 🛡️ Supported Versions

| Version | Supported |
| :--- | :--- |
| `main` (Latest) | ✅ Active Security Support |

---

## 🚨 Reporting a Vulnerability

If you discover a potential vulnerability in ClipSync PRO's cryptographic implementation, WebRTC signaling, or edge functions:

1. **Do not create public GitHub issues or discussions.**
2. Send a responsible disclosure report directly to:
   - **Email:** `tanmaynileshshinde@gmail.com`
   - **Subject Line:** `[SECURITY] ClipSync PRO Vulnerability Report`
3. Include:
   - Reproduction steps and proof of concept.
   - Affected component (crypto, p2p, edge api, pwa).
   - Expected vs actual behavior.

### ⏱️ Triage & Response Timeline
- **Acknowledgment:** Within 24-48 hours.
- **Remediation & Patch:** Within 7 days for critical findings.
