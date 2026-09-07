# 🚀 FiveM Cement Map - Workspace AI Rules

## 🛡️ Strict Token Budget & Zero-Waste Protocol
1. **No Bulk SKILL.md Reads**: Do NOT read full `SKILL.md` files into context. Use internalized knowledge.
2. **Surgical Diffs Only**: Use `replace_file_content` with minimal line ranges. Never rewrite full files.
3. **Strict Output Limits**: Always clamp terminal output (`git log -n 5`, `head -n 20`, `--stat`).
4. **Never Read Bloat**: Avoid reading `dist/`, `node_modules/`, `package-lock.json`, or minified bundles.
5. **Direct Execution**: Solve tasks directly without spawning multi-agent overhead unless explicitly instructed.
6. **High-Signal Responses**: Keep communication concise, direct, and focused on verified code changes.
