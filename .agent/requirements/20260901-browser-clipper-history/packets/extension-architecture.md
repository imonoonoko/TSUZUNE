# Extension-architecture review packet

- purpose: Select the smallest secure local Chrome/Edge Manifest V3 path for one-click capture.
- ownership: Read official Chrome documentation and the repository-integration result; write only `results/extension-architecture.md`.
- forbidden: Code edits, Chrome Web Store work, third-party APIs, direct arbitrary filesystem writes.
- source of truth: Official Chrome docs and current repository.
- acceptance: Compare localhost HTTP, Native Messaging, custom protocol, downloads, and File System Access where applicable; recommend one with permissions, UX, install burden, and failure behavior.
- unseen boundary: Unpacked extension ID stability and service-worker lifecycle.
- stop/escalation: Stop if the chosen route needs a new user credential or machine-wide policy.
