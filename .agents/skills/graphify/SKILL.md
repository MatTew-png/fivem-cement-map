---
name: graphify
description: >-
  Builds deterministic code and dependency knowledge graphs using local AST parsing.
  Maps call trees, class hierarchies, SQL schema relations, and blast-radius impact analysis
  without external vector databases.
license: Apache-2.0
metadata:
  version: v1
  author: tewtus
---

# 🕸️ Graphify: Codebase Knowledge Graph & AST Reasoner

Inspired by `Graphify-Labs/graphify`, this skill turns complex codebases into a navigable graph of components, dependencies, and interfaces. It allows the agent to reason about architecture, trace execution paths, and evaluate the blast radius of proposed edits.

---

## 🧭 Core Capabilities

### 1. Deterministic AST Call & Reference Graph
Instead of fuzzy vector search, AST parsing extracts exact syntax tokens:
* **Caller / Callee Map**: Who calls function `X`? What functions does `X` call?
* **Inheritance & Trait Graph**: Which classes implement interface `Y`?
* **Imports & Module Flow**: How data and modules flow across the project.

### 2. Blast-Radius Impact Analysis
Before modifying a core function or schema:
1. Identify all incoming edges (callers, importers, subscribers).
2. Assess whether the change modifies the return contract, type signature, or side-effects.
3. Mark dependent files as "Review Targets" to prevent silent regression.

### 3. Quick AST Symbol Extraction Protocol
To inspect Python symbols without reading entire files:
```bash
python3 -c '
import ast, sys
tree = ast.parse(open(sys.argv[1]).read())
for node in ast.walk(tree):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
        print(f"{type(node).__name__}: {node.name} (line {node.lineno})")
' path/to/file.py
```

To find cross-file references with zero hallucination:
Use `grep_search` with exact symbol names across the project tree.

---

## 🎯 When to Use
- **Large Refactoring**: Before changing public API methods or database schemas.
- **Onboarding / Codebase Exploration**: When analyzing how different folders or services communicate.
- **Coupling Audits**: When checking if modules are tightly coupled or respect clean architecture.
