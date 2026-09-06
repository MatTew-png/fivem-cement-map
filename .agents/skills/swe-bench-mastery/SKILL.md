---
name: swe-bench-mastery
description: >-
  Elite coding agent methodology inspired by top SWE-bench solvers and Aider.
  Enforces minimal one-command reproduction scripts, surgical AST localization,
  atomic patching, and dual regression verification.
license: Apache-2.0
metadata:
  version: v1
  author: tewtus
---

# 🏆 SWE-Bench Mastery: Elite Problem-Solving Protocol

Inspired by top-performing autonomous agents on the SWE-bench benchmark (such as SWE-agent, Aider, and OpenHands), this skill enforces a rigorous, test-driven resolution protocol for fixing bugs, solving issues, and implementing complex features.

---

## 🔁 The 4-Phase SWE Resolution Cycle

```text
[Phase 1: Minimal Reproducer] ──▶ Write standalone script that FAILS on current code
           │
[Phase 2: Surgical Localization] ──▶ Narrow down exact fault lines via AST / symbols
           │
[Phase 3: Atomic Patching]       ──▶ Make minimal, precise diff edits (no bloat)
           │
[Phase 4: Dual Verification]     ──▶ Prove reproducer PASSES + existing tests PASS
```

---

## 🧪 Phase 1: Minimal One-Command Reproducer (Failure First)

**Rule: Never touch production source code until you have proven the bug exists in the terminal.**

1. **Create a standalone reproduction script** in the conversation scratch directory:
   * Location: `<appDataDir>/brain/<conversation-id>/scratch/reproduce_<issue>.py` (or `.sh` / `.js`)
2. **Requirements for the Reproducer**:
   * Must run with a single command (e.g. `python3 scratch/reproduce_issue.py`)
   * Must require zero manual interaction
   * Must exit with code `0` when expected behavior occurs
   * Must exit with non-zero exit code (e.g. `assert` error or `sys.exit(1)`) when the bug occurs
3. **Execute the reproducer immediately**:
   * Verify that it fails for the exact reason stated in the issue.
   * If it passes or fails due to a syntax/import error, fix the reproducer first.

---

## 🎯 Phase 2: Surgical Localization (Symbols Over Context)

**Rule: Do not flood context with whole source files. Find the precise symbol.**

1. **Identify the Call Stack**:
   * Inspect the stack trace produced by the Phase 1 reproducer.
2. **Grep and AST Search**:
   * Use targeted `grep_search` to find definition points of functions and classes.
   * View only the relevant function body (e.g., 20-50 lines) using `view_file` with `StartLine` and `EndLine`.
3. **Establish Invariants**:
   * What was the function's expected input contract?
   * At which line does state diverge from expectations?

---

## 🩹 Phase 3: Atomic Patching (Surgical Edits)

**Rule: Minimal character and line modifications. No unsolicited refactoring.**

1. **Single Responsibility Edit**:
   * Use `replace_file_content` targeting only the affected block.
   * Do not change formatting, variable names, or whitespace in unrelated lines.
   * Preserve all existing comments and docstrings.
2. **Avoid Cascading Assumptions**:
   * Fix the root cause at the deepest appropriate layer, not by monkey-patching callers.

---

## ✅ Phase 4: Dual Verification (Terminal Truth)

**Rule: A fix is only valid when both the reproducer and the regression suite pass.**

1. **Step 1 - Reproducer Check**:
   * Run the Phase 1 reproducer command.
   * It must exit with code `0`.
2. **Step 2 - Regression Sweep (Sibling Impact)**:
   * Run the existing project test suite (e.g. `pytest`, `npm test`, `cargo test`).
   * Confirm no existing functionality was broken by the patch.
3. **Step 3 - Permanent Test Integration**:
   * If the project has an active test suite, migrate the reproduction logic into a formal test file (e.g., `tests/test_<feature>.py`).
   * Clean up temporary scratch scripts.

---

## 🚫 Common Pitfalls to Avoid

* **"Diff Blindness"**: Assuming a code change works just because the diff looks clean. You must execute and verify via the terminal.
* **Premature Fixing**: Editing source code based on a hunch before reproducing the bug.
* **Scope Creep**: Fixing unrelated linter warnings or stylistic issues in files touched during the bug fix.
