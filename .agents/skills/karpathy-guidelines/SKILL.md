---
name: karpathy-guidelines
description: >-
  Eliminates common LLM coding pitfalls based on Andrej Karpathy's empirical observations.
  Enforces surgical code changes, anti-hallucination of APIs, preserving working patterns,
  and avoiding unnecessary abstractions.
license: Apache-2.0
metadata:
  version: v1
  author: tewtus
---

# 🧠 Karpathy Guidelines: Anti-Pitfall Coding Protocol

Derived from Andrej Karpathy's direct observations on how LLMs make mistakes when writing software, this skill serves as an invariant behavioral guardrail.

---

## 🚫 The 6 Cardinal Sins of LLM Coding (Karpathy Pitfalls)

### 1. The "Clean Slate" Fallacy (Never Overwrite Working Architecture)
* **Pitfall**: When asked to fix a minor issue, LLMs tend to rewrite entire files, deleting existing comments, helpers, docstrings, or subtle edge-case handling.
* **Invariant Rule**: Always make **surgical, atomic edits** (`replace_file_content`). Treat untouched lines as precious. Never perform total file rewrites unless explicitly directed.

### 2. Phantom API Hallucination
* **Pitfall**: Calling functions, methods, flags, or CLI parameters that "sound plausible" but do not exist in the installed version of a library.
* **Invariant Rule**: 
  * If unsure of a signature, inspect the actual source code or docs with `python3 -c "import pkg; help(pkg.func)"` or view the definition.
  * Never invent convenient parameters.

### 3. Premature Abstraction & "Architectural Inflation"
* **Pitfall**: Introducing Abstract Factory patterns, generic wrappers, custom base classes, or 5-layer indirection for a simple 10-line task.
* **Invariant Rule**: 
  * Solve the specific problem directly in the simplest, most readable way.
  * Duplicate 3 times before considering an abstraction.

### 4. Silent Assumption of Silent Success
* **Pitfall**: Generating code and immediately claiming "Done!" without running it in the terminal.
* **Invariant Rule**: **Terminal Truth Principle**. A task is only complete when verified by an actual command in the shell with Exit Code 0 and expected output.

### 5. Dependency Creep
* **Pitfall**: Reaching for heavy external libraries (`pandas`, `scipy`, `langchain`) when standard library modules (`csv`, `math`, `json`, `subprocess`) can do the job in 5 lines.
* **Invariant Rule**: Prefer zero-dependency or existing dependencies in the active venv.

### 6. Context Amnesia & Sibling Breakage
* **Pitfall**: Changing a function signature or return type in file A without checking its callers in files B, C, and D.
* **Invariant Rule**: Always run a **Sibling Sweep** (`grep_search`) across the workspace before changing any public interface.

---

## 📋 The Karpathy Pre-Commit Checklist

Before declaring any coding task finished:
- [ ] Did I make the smallest diff possible?
- [ ] Did I verify all called APIs exist in reality?
- [ ] Did I run the code in the shell and check the exit code?
- [ ] Did I keep all existing docstrings, types, and comments?
- [ ] Did I verify no other files broke due to interface changes?
