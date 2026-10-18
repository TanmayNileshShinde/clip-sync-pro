# System Architecture — ClipSync Pro

This document details the client-side AES-GCM 256 encryption pipeline, QR-based ephemeral pairing handshake, and chunked WebRTC data transfer.

## Architecture Overview

```text
[ Device A (Local) ]                                      [ Device B (Remote) ]
        |                                                           |
  [ Web Crypto API ]                                          [ Web Crypto API ]
  (AES-GCM 256 Gen)                                           (AES-GCM 256 Dec)
        |                                                           |
  [ QR Pairing Code ]  ---- Visual / Out-of-band Key Exch ---->  [ QR Scanner ]
        |                                                           |
        +======== Direct WebRTC Encrypted DataChannel ==============+
```

### Security Layers
1. **Key Generation:** 256-bit symmetric cryptographic keys are generated in volatile memory via `window.crypto.subtle.generateKey`.
2. **Chunking & IVs:** Each chunk receives an initialization vector (IV) to prevent replay vulnerabilities.
3. **Zero Plaintext Footprint:** No unencrypted data is ever written to persistent storage or unencrypted WebSocket channels.
