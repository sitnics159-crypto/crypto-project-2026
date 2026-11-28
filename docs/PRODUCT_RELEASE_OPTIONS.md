# Product release options — Crypto Project 2026

Decision recorded: 28 November 2026.

## Geographic scope

Moldova is excluded from the project's target-market list and must not be reintroduced into current target-market planning. International market selection remains subject to country-by-country legal, provider-availability, sanctions, privacy, and commercial review. This document does not assert that the service is available or lawful in every country.

## Product configuration

### Option A — primary release, with Kraken market data

The preferred product configuration retains the existing market-information section:
- BTC/USD and ETH/USD spot ticker information from Kraken.
- Hourly OHLC context where the provider returns sufficient data.
- Existing Sepolia transaction, address, and ERC-20 analysis through the project API and Blockscout.

Kraken remains in the primary product plan, subject to current Kraken API terms, rate limits, attribution requirements, geographic availability, and operational reliability checks. Market data is informational only and is not an investment recommendation.

### Option B — fallback release, without Kraken

A fallback configuration must remain deployable if Kraken data is unavailable, restricted, or not approved for the relevant release context:
- Retain Sepolia transaction, address, and ERC-20 analysis.
- Hide or disable the market-information section with a clear explanation.
- Do not replace unavailable Kraken values with stale, fabricated, or unlabelled third-party data.

These are two release configurations of the same product, not two separate products and not a promise of access in every country.

## Release gates

Before release:
1. Verify current Kraken API terms and the intended use of ticker/OHLC data.
2. Verify the service's country availability and any applicable restrictions.
3. Test the primary configuration with Kraken unavailable or rate-limited.
4. Test the fallback configuration and confirm Sepolia features remain usable.
5. Ensure market data is clearly timestamped and labelled as informational.
6. Keep provider credentials, if any, server-side; never expose secrets in the browser.
7. Record operational monitoring, incident handling, and rollback steps.

## Current technical caveat

The Sepolia API currently has an in-process request limiter by default. It is not a shared global quota across multiple service instances. Before scaling to multiple instances, configure and test a shared limiter or explicitly keep a single-instance deployment with documented limits. Do not claim distributed rate limiting until it is implemented and verified.

## Approval status

This document records the product decision. It does not itself approve a production deployment, a paid service plan, a provider contract, or a commercial launch.
