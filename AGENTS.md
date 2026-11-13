# Agent Instructions

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing this app.

- Keep work within the requested bounded context. Treat the six other agreed contexts as future work unless a task explicitly authorizes them.
- Keep changes within the requested context, preserve unrelated work, and update `CHANGELOG.md` for meaningful changes.
- Do not perform Git operations unless explicitly authorized.
- Preserve local runtime configuration. Do not print or commit `public/config.json` or include server credentials in browser configuration.
- Keep domain code framework-independent, follow the documented naming and comment rules, and reuse existing tokens, icons, and visual patterns.
- Route every user-visible string through `translate`, and keep `public/i18n/en.json` and `public/i18n/es.json` with the same key set.
- Do not create empty speculative folders or `.gitkeep` files.
- Report the paths changed and checks actually performed. Do not claim live REST verification while the backend is unavailable.