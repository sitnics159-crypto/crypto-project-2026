# Internationalization foundation

Preserve the existing Russian interface as the default during migration. Do not change main until review and regression checks pass.

## Architecture
- Stable message identifiers, separate dictionaries, explicit fallback to Russian during migration.
- Initial complete locales: Russian and English; expand only after translation review.
- Explicit language selection overrides browser language; unsupported locales fall back safely. No persistent storage required.
- Set document lang and dir from an allowlisted locale; use logical CSS properties for RTL readiness.
- Keep blockchain addresses, hashes, exact decimal amounts and CSV machine-readable fields independent of locale. Use Intl for dates and display-only fiat values; never convert exact token quantities to Number.
- Render translated strings using textContent, never HTML injection. Preserve CSP and existing API allowlist.

## Acceptance gates
- Existing Russian regression suite remains green.
- English dictionary key parity and missing-key fallback tests.
- Browser tests for language switching, dynamic errors, loading states, accessible names, and transaction/address results.
- RTL layout test before claiming RTL language support.
- No new tracking, wallet connection, or external translation requests.
- No deployment from feature branch; merge only after checks and review.
