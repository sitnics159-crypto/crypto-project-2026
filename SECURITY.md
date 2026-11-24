# Security Policy

## Supported versions

This repository currently maintains a prototype on the default branch, `main`.
Security fixes are applied to the latest state of `main`. There are no separately
supported release branches at this time.

## Reporting a vulnerability

Please do **not** report suspected vulnerabilities in public issues, pull requests,
or discussions. Do not publish exploit details, affected user data, credentials,
private keys, or seed phrases.

1. Open the repository's **Security** tab and go to **Advisories**.
2. If the **Report a vulnerability** button is available, use it to submit a
   private vulnerability report to the maintainers.
3. If private vulnerability reporting is not enabled and the button is absent,
   open a public issue with only the title **"Request private security contact"**.
   Do not include vulnerability details or proof of concept. Ask the maintainers
   to provide a private channel, then share technical details only through that
   channel.

When reporting, include the affected URL or file, the steps needed to reproduce
the issue, its potential impact, and any safe proof of concept. Avoid testing
against other people's wallets, accounts, or infrastructure.

## Scope and safety

The project is a static prototype that reads public Ethereum Sepolia data and
public market reference data. It does not need wallet connections, private keys,
seed phrases, transaction signing, or transaction submission. Never send such
secrets to the project or include them in a report.

Please allow maintainers reasonable time to investigate and coordinate a fix
before public disclosure. No response-time or bug-bounty commitment is currently
offered.
