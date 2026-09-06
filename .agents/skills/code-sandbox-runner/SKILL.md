---
name: code-sandbox-runner
description: >-
  Safe, isolated execution patterns for testing scripts, untrusted code, and
  experimental dependencies without polluting the host environment. Uses disposable
  Python venvs, local temporary directories, and Docker containers.
license: Apache-2.0
metadata:
  version: v1
  author: tewtus
---

# 🛡️ Code Sandbox Runner: Safe & Isolated Execution Protocol

When testing code, reproducing issues, or evaluating third-party scripts, agents must prevent side-effects, host machine pollution, and accidental data damage. This skill establishes a tiered isolation strategy—costing **0 THB** and running entirely local-first.

---

## 🏗️ The 3-Tiered Isolation Hierarchy

```text
[Tier 1: Scratch Directory]     ──▶ One-off scripts & local verification tests
           │
[Tier 2: Disposable Python Venv] ──▶ Scripts requiring new or conflicting pip packages
           │
[Tier 3: Local Docker Sandbox]  ──▶ Untrusted binaries, destructive scripts, network-isolated tasks
```

---

## 📁 Tier 1: Scratch Directory (Default for Light Scripts)

* **Location**: `<appDataDir>/brain/<conversation-id>/scratch/`
* **Rule**: Never create temporary test files (like `test.py`, `temp.json`, `reproduce.sh`) in the project root or user home directory. Always place them in the scratch directory.
* **Execution**:
  ```bash
  python3 <appDataDir>/brain/<conversation-id>/scratch/reproduce.py
  ```

---

## 🐍 Tier 2: Disposable Virtual Environment (Pip Isolation)

**Rule: Never run global `pip install` on the user's host machine for experimental scripts.**

When an experiment or reproduction requires third-party dependencies:

1. **Create disposable venv inside scratch**:
   ```bash
   SCRATCH="<appDataDir>/brain/<conversation-id>/scratch"
   python3 -m venv "$SCRATCH/.venv"
   ```
2. **Install and run inside the isolated venv**:
   ```bash
   "$SCRATCH/.venv/bin/pip" install --quiet <package-name>
   "$SCRATCH/.venv/bin/python" "$SCRATCH/reproduce.py"
   ```
3. **Teardown**:
   When testing is complete, remove the venv directory to save disk space:
   ```bash
   rm -rf "$SCRATCH/.venv"
   ```

---

## 🐳 Tier 3: Local Docker Sandbox (Zero-Risk Hard Isolation)

When code execution involves arbitrary shell scripts, high filesystem modifications, or untrusted code:

1. **Check Docker status**:
   ```bash
   docker info >/dev/null 2>&1 && echo "DOCKER_AVAILABLE" || echo "DOCKER_DOWN"
   ```
2. **Run ephemeral container**:
   ```bash
   docker run --rm \
     --network none \
     -v "$(pwd):/app:ro" \
     -w /app \
     python:3.11-slim \
     python3 /app/script.py
   ```
   * `--rm`: Container automatically deletes itself after execution.
   * `:ro`: Mounts host code as read-only to prevent accidental deletion.
   * `--network none`: Prevents unauthorized external network calls if executing untrusted code.

---

## ☁️ Tier 4: E2B Cloud Sandbox (Optional Cloud MicroVM)

If the user explicitly requests cloud-based MicroVM execution (e.g. from `e2b-dev`), use the E2B Code Interpreter SDK with their free tier API key:
* Start session: `const sandbox = await Sandbox.create()`
* Run commands: `await sandbox.commands.run("python3 -c '...'")`
* Destroy session immediately upon task completion.

---

## 🚫 Operational Guardrails
1. **Never run `rm -rf /` or broad deletes**: Follow the `accidental-data-loss-prevention` rule strictly.
2. **Clean up background processes**: If a test spins up a server or background daemon, ensure it is killed via `manage_task` or `kill -9` when done.
3. **Check return codes**: Never infer execution success from stdout text alone; verify exit code 0.
