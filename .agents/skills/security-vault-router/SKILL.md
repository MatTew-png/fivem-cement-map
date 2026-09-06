---
name: security-vault-router
description: "Routes and retrieves deep cybersecurity skills from the local 818-skill vault (~/.agent-sync/vault/cybersecurity-skills). Use when developing security-critical systems (fintech, gaming marketplaces, e-commerce, payment gateways, authentication, anti-fraud, or API defenses) or performing security audits."
risk: safe
source: custom
version: "1.0"
---

# 🛡️ Security Vault Router (On-Demand Cyber Defense)

You have access to a complete offline vault of **818 professional cybersecurity playbooks** located at:
`~/.agent-sync/vault/cybersecurity-skills/skills/<skill-name>/SKILL.md`

This skill acts as the **Intelligent Router** to identify, retrieve, and apply the exact security playbooks needed for high-risk applications (e.g., in-game trading, financial transactions, payments, user authentication, and anti-fraud) **without bloating the context window**.

---

## 🎮 High-Risk Scenario: Gaming Marketplace & In-Game Trading with Real Money

When the user is building an in-game marketplace, cash shop, or virtual item trading system, security is Priority #1. Financial and inventory vulnerabilities lead directly to real-world monetary loss.

### The 5 Core Vulnerabilities & Required Vault Playbooks:

#### 1. Item Duplication & Balance Race Conditions (Double-Spending)
* **The Threat**: Attackers send concurrent parallel requests (e.g. two requests at the exact same millisecond) buying an item with the same funds, or trading an item to two players simultaneously before balance/inventory state locks.
* **Vault Playbooks to Inspect**:
  - `implementing-api-rate-limiting-and-throttling`
  - `implementing-api-schema-validation-security`
* **Architectural Invariant**:
  - NEVER do `balance = balance - price` in application memory without database row-level locking.
  - Use database transactions with pessimistic locking (`SELECT ... FOR UPDATE`) or atomic decrements:
    `UPDATE accounts SET balance = balance - 100 WHERE id = :user_id AND balance >= 100;`
  - Ensure idempotency keys (`Idempotency-Key` header) on all transfer and checkout endpoints.

#### 2. IDOR (Insecure Direct Object Reference) on Inventory & Orders
* **The Threat**: Changing `item_id=999` or `order_id=456` in API requests allows malicious users to sell other players' items or claim payouts meant for other sellers.
* **Vault Playbooks to Inspect**:
  - `exploiting-idor-vulnerabilities`
  - `detecting-broken-object-property-level-authorization`
  - `exploiting-broken-function-level-authorization`
* **Architectural Invariant**:
  - Every inventory query MUST scope by the authenticated session:
    `SELECT * FROM user_inventory WHERE id = :item_id AND owner_id = :session_user_id;`

#### 3. Payment Gateway & Webhook Tampering
* **The Threat**: Attackers forging fake webhook callbacks to `/api/webhooks/payment` or replaying old successful webhooks to credit in-game currency without paying.
* **Vault Playbooks to Inspect**:
  - `conducting-api-security-testing`
  - `implementing-api-schema-validation-security`
* **Architectural Invariant**:
  - ALWAYS verify cryptographic HMAC signatures using the raw, unparsed request body.
  - Store payment gateway transaction IDs (`payment_intent_id`) in a unique-indexed table to prevent webhook replay attacks.
  - Verify transaction amount directly against the payment provider API before releasing in-game items.

#### 4. Anti-Fraud & Chargeback Abuse (MITRE F3)
* **The Threat**: Attackers using stolen credit cards to buy high-value items, immediately trading them to burner accounts or laundering through in-game gifting, leaving the store with 100% chargeback penalties.
* **Vault Playbooks to Inspect**:
  - `detecting-business-email-compromise` (mapped to MITRE F3 Monetization)
  - `detecting-anomalous-authentication-patterns`
* **Architectural Invariant**:
  - Implement holding periods (escrow/cooldown) on newly purchased in-game items before they can be transferred or withdrawn.
  - Risk scoring on checkout: flag suspicious IP hops, VPN proxies, and velocity limits (max purchases per hour).

#### 5. Authentication, OAuth & Bot Abuse
* **The Threat**: Automated bot sniping of underpriced items, credential stuffing, and session token hijacking.
* **Vault Playbooks to Inspect**:
  - `configuring-oauth2-authorization-flow`
  - `detecting-oauth-token-theft`
  - `implementing-api-abuse-detection-with-rate-limiting`
* **Architectural Invariant**:
  - Store JWT/Session cookies with `HttpOnly; Secure; SameSite=Strict`.
  - Rate-limit sensitive endpoints (login, checkout, search) using Redis token buckets.

---

## 🔍 How to Retrieve and Apply Skills on Demand

When a project requires specific deep security guidance:
1. Locate the playbook in the local vault:
   `~/.agent-sync/vault/cybersecurity-skills/skills/<playbook-name>/SKILL.md`
2. View the file using `view_file` to read the exact Python scripts, Sigma detection rules, and implementation steps.
3. Apply the security controls directly to the application architecture and code.
