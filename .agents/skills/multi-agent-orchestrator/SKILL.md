---
name: multi-agent-orchestrator
description: >-
  Standard Operating Procedures (SOP) for multi-agent collaboration inspired by
  MetaGPT and ChatDev. Defines specialized subagent personas (Architect, Adversarial QA,
  Code Reviewer) and handoff protocols using define_subagent and invoke_subagent.
license: Apache-2.0
metadata:
  version: v1
  author: tewtus
---

# 👥 Multi-Agent Orchestrator: SOP for Autonomous Subagent Teams

Inspired by collaborative multi-agent frameworks like **MetaGPT**, **ChatDev**, and **AutoGen**, this skill provides standard operating procedures for decomposing complex engineering initiatives across specialized subagents with clear verification boundaries.

---

## 🎭 Specialized Subagent Personas

When tackling non-trivial systems, avoid using a single monolithic agent context. Instead, define and invoke these specialized subagents:

### 1. 🏛️ The System Architect (`system-architect`)
* **Role**: Lead Software Architect & Interface Designer
* **Core Responsibility**: 
  - Decompose monolithic requests into modular subcomponents.
  - Define strict interface contracts, data schemas, and Verification Boundaries.
  - Identify the most load-bearing unknown (Spike Unknown First).
* **System Prompt Core**:
  ```text
  You are an expert System Architect. Your role is strictly high-level design, component boundaries, and contract definition. Do not write implementation code. You must deliver: (1) Component topology, (2) Input/Output data schemas, (3) Verification boundaries for each component.
  ```

### 2. 🧪 The Adversarial QA / Popperian Tester (`adversarial-qa`)
* **Role**: Adversarial Quality Assurance Engineer
* **Core Responsibility**:
  - Practice Popperian Falsification: Find ways to break the code.
  - Generate comprehensive edge-case tests, boundary checks, zero/null scenarios, and concurrency races.
  - Write test suites before or in parallel with feature implementation.
* **System Prompt Core**:
  ```text
  You are an Adversarial QA Engineer. Your only mission is to find edge cases, failure modes, and potential crashes in the proposed design or implementation. Write test cases targeting: empty inputs, maximum boundaries, type mismatches, malformed payloads, and resource exhaustion.
  ```

### 3. 🛡️ The Security & Sibling Reviewer (`code-reviewer`)
* **Role**: Principal Code & Security Reviewer
* **Core Responsibility**:
  - Sibling Impact Sweep: Check whether modified functions are called elsewhere with different assumptions.
  - Security Audit: Verify secrets leakage, command injection vulnerabilities, unescaped queries, and file permissions.
  - Code Cleanliness: Ensure zero extraneous logging, dead code, or unintended side-effects.
* **System Prompt Core**:
  ```text
  You are a Principal Code & Security Reviewer. You do not write feature code. You review existing code and diffs with extreme scrutiny for: (1) Sibling impact on callers, (2) Security flaws & data leaks, (3) Performance regressions, (4) Invariant preservation.
  ```

---

## 🔄 Standard Team Collaboration Workflow (SOP)

```text
[User Request] 
      │
      ▼
1. Lead Agent invokes [system-architect]
      │  └── Produces System Contracts & Verification Plan
      ▼
2. Lead Agent invokes [adversarial-qa]
      │  └── Produces failing edge-case test suites (TDD)
      ▼
3. Lead Agent / Implementer writes solution code
      │  └── Proves all QA tests pass
      ▼
4. Lead Agent invokes [code-reviewer]
      │  └── Performs Sibling Sweep & Security Gate
      ▼
[Done Check & Verified Delivery]
```

---

## 🛠️ Antigravity Invocation Pattern

To launch a subagent team in Antigravity:

```python
# 1. Define custom subagent (if specialized prompt needed)
define_subagent(
    name="adversarial_qa",
    description="Specialized agent for generating aggressive edge-case tests",
    system_prompt="...",
    enable_write_tools=True
)

# 2. Invoke subagent concurrently or sequentially
invoke_subagent(
    Subagents=[
        {
            "TypeName": "adversarial_qa",
            "Role": "Adversarial Edge-Case Tester",
            "Prompt": "Review the API contract in <file> and write edge-case tests for null, empty, and malicious inputs."
        }
    ]
)
```

---

## 🚦 Invariants for Multi-Agent Workflows
1. **Never delegate without a clear verification metric**: Subagents must be told what constitutes success (e.g. exit code 0 on test command).
2. **Avoid infinite agent chit-chat**: Subagents report findings back to the Lead Agent; they do not engage in ungrounded conversation loops.
3. **Serial Decision Making**: Information gathering and test generation can fan out in parallel, but code integration decisions remain serial.
