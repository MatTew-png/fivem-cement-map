---
name: markitdown
description: >-
  Converts documents (PDF, DOCX, PPTX, XLSX, images, audio, HTML) into clean, LLM-friendly Markdown.
  Powered by Microsoft MarkItDown in local isolated environment.
license: MIT
metadata:
  version: v1
  author: tewtus
---

# 📄 MarkItDown: Universal Document to Markdown Converter

Powered by `microsoft/markitdown`, this skill equips the agent to ingest arbitrary binary office files, slides, spreadsheets, and PDFs, converting them deterministically into structured Markdown for analysis, summarization, or translation.

---

## 🛠️ CLI Execution Path

MarkItDown is installed in the agent's dedicated tool virtual environment:
```bash
/Users/tewtus/.gemini/tools_venv/bin/markitdown <input_file> [-o <output.md>]
```

Or via Python script:
```python
from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("path/to/document.pdf")
print(result.text_content)
```

---

## 📂 Supported Formats

- **PDF Documents** (`.pdf`): Extracts text, tables, formatting.
- **Microsoft Word** (`.docx`): Converts headings, lists, tables, bold/italic.
- **Microsoft Excel** (`.xlsx`, `.xls`): Converts sheets and cells into Markdown tables.
- **Microsoft PowerPoint** (`.pptx`): Converts slide decks into structured sections.
- **Audio Files** (`.wav`, `.mp3`): Transcribes speech (with whisper model support).
- **HTML & Web Content** (`.html`): Strips boilerplate and renders clean markdown.
- **ZIP Archives**: Recursively inspects and extracts documents inside.

---

## 🎯 Usage Protocol

1. When the user provides or points to a `.pdf`, `.docx`, `.xlsx`, or `.pptx` file:
   * Run:
     ```bash
     /Users/tewtus/.gemini/tools_venv/bin/markitdown /path/to/file.ext -o <scratch>/extracted.md
     ```
2. Read the resulting `<scratch>/extracted.md` with `view_file` to answer the user's questions or perform downstream processing.
