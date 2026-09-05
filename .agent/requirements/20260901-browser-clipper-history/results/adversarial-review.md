# Adversarial implementation review

Findings adopted by root:

- Concurrent requests with one `requestId` could create two notes. Added an in-flight Promise map and a concurrent regression test.
- A five-minute six-digit pairing window allowed unlimited guesses. Added a five-failure invalidation boundary and test.
- Oversized requests now reject declared content length before reading the body.
- Sanitized DOM clone was not used; metadata attributes were read incorrectly; YouTube lookalike hosts and shorts/embed paths were mishandled. Extraction and self-checks were corrected.
- The injected file initially returned `undefined` to `chrome.scripting.executeScript`; the script now returns the exact capture packet and the self-check asserts it.
- Empty page titles now fall back to the source hostname.

Sound boundaries retained:

- HTTP(S)-only source URLs, dynamic Markdown fences, JSON-safe YAML values, collision-safe Vault creation, fixed Inbox directory, minimal MV3 permissions, fixed origin and port, bearer comparison, and no-store responses.

Residual boundary: this design does not defend against malicious software already running as the same Windows user, and browser manual acceptance remains separate from source verification.
