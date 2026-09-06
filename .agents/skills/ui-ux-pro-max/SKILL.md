---
name: ui-ux-pro-max
description: >-
  Comprehensive design intelligence system for professional UI/UX, web apps, and dashboards.
  Applies 192 industry rules, 79 searchable styles, font pairing, color harmony,
  and anti-pattern filtering for clean frontend development.
license: MIT
metadata:
  version: v2
  author: tewtus
---

# 🎨 UI/UX Pro Max: Design Intelligence System

Inspired by `nextlevelbuilder/ui-ux-pro-max-skill` ([uupm.cc](https://uupm.cc)), this skill equips the agent with professional design intelligence to generate polished, accessible, and domain-appropriate user interfaces across React, Vue, Svelte, Tailwind, and plain HTML/CSS.

---

## 📐 5-Step Design System Reasoning Workflow

Whenever asked to create or redesign an interface:

```text
[1. Industry Matching]   ──▶ Match domain (SaaS, E-commerce, Fintech, Healthcare, Luxury, etc.)
            │
[2. Style Selection]     ──▶ Pick from 79 styles (Bento Grid, Soft UI, Minimalist, Glassmorphic)
            │
[3. Color Harmony]       ──▶ Generate Primary, Secondary, CTA (contrast >= 4.5:1 WCAG AA)
            │
[4. Typography Pairing]  ──▶ Pair Heading font + Body font with clear font scales
            │
[5. Anti-Pattern Filter] ──▶ Strip out amateur mistakes (AI purple gradients, missing pointer cursors)
```

---

## 🎨 Popular UI Style Archetypes

1. **Bento Grid**: Card-based modular layouts, subtle borders, high information density (ideal for SaaS dashboards, developer tools).
2. **Soft UI Evolution**: Subtle organic shadows, calming pastel accents, rounded corners (ideal for wellness, lifestyle, consumer apps).
3. **Clean Brutalism / Neo-Brutalism**: High contrast, bold black borders, distinct drop shadows, punchy typography (ideal for developer tools, Web3, cutting-edge products).
4. **Editorial Minimalist**: Elegant serif headers (Cormorant, Playfair), clean sans body, generous whitespace (ideal for luxury, portfolio, fashion).
5. **Modern Dark Mode**: Deep slate `#0F172A` (never pure `#000000`), glowing accent highlights, accessible contrast.

---

## 🚫 Pre-Delivery Anti-Pattern Checklist (Must Check Before Finalizing UI)

- [ ] **No Emoji as Icons**: Use clean SVGs (Lucide, Heroicons, Phosphor) instead of emojis.
- [ ] **Cursor Pointer**: Explicitly set `cursor: pointer` on all interactive buttons, cards, and toggles.
- [ ] **Contrast Ratio**: Verify text contrast is at least 4.5:1 against background (WCAG AA).
- [ ] **No Cliché AI Gradients**: Avoid tacky purple-to-pink gradients on plain white containers.
- [ ] **Focus States**: Ensure visible focus outline for keyboard accessibility.
- [ ] **Motion Sensitivity**: Respect `@media (prefers-reduced-motion: reduce)`.
- [ ] **Responsive Breakpoints**: Verify layout reflow on 375px (mobile), 768px (tablet), and 1280px+ (desktop).
