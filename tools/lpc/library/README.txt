LPC parts library for the Character Builder on your PC
======================================================

This folder is the Character Builder's library of Liberated Pixel Cup (LPC) sprite parts:
catalog.json (every part, its animations, colours and credits), packs/ (the sprites) and
thumbs_0.png (previews). It's the same library the hosted builder on claude.ai uses.

It belongs in the engine folder at tools/lpc/library/. Then double-click
"Start Character Builder.bat" (or use the Character Builder button in the map editor).

The builder offers only Steam-safe parts (CC0 or OGA-BY) unless you untick
"Steam-safe parts only". Exported characters carry their credits inside the PNG.
Rebuild it from the LPC generator with: python tools/lpc/build_lpc.py <repo> tools/lpc/library
