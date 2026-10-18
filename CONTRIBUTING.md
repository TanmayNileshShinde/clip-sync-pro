# Contributing to ClipSync Pro

Thank you for contributing to ClipSync Pro!

## Cryptographic Security Requirements
- All data transmission MUST use client-side AES-GCM 256 encryption.
- Keys must never be logged or transmitted in unencrypted plaintext.
- Peer verification tokens must use cryptographically secure random bytes via `crypto.getRandomValues`.

## Pull Request Guidelines
- Follow TypeScript strict typing rules.
- Test cross-device clipboard sync scenarios before submitting changes.
