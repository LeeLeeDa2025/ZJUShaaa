# Story Cache Display Name Reuse

## Goal

Reuse the existing second-part story cache when the uploaded photo and story branch are unchanged, even if the user enters a different name or nickname. The displayed character label must match the current form input rather than the label stored when the cached scene was generated.

## Confirmed Rules

- The preferred display label is `nickname.trim()` when a nickname is provided.
- When nickname is empty, the display label falls back to `name.trim()`.
- Name and nickname do not restrict story cache lookup.
- Cache lookup must continue to distinguish photo hash, player gender, poster style, story theme, illustration style, choice path, and cache version.
- Cached images and branch results are reused; a name-only change must not invoke text or image generation.

## Compatibility With Existing Cache

The repository already contains `v5` cache entries whose filenames include a hash of the original `name|nickname`. These files must remain usable without regenerating them.

Lookup behavior:

1. Try the new identity-independent cache key for newly written scenes.
2. If that key does not exist, find a matching legacy `v5` entry with the same photo hash, gender, poster style, theme, illustration style, and choice path while ignoring the stored name hash.
3. When a legacy entry is reused, it may be promoted into the new key so future reads do not need legacy discovery.

## Text Personalization

Cached narrative and choices can contain the label used during prewarming. To prevent stale names from appearing:

- Store the source display label in newly written cache metadata.
- For legacy cache entries without metadata, resolve source labels only from configured prewarm/demo inputs whose `name|nickname` hash matches the legacy filename.
- On a cache hit, return narrative and choices with the cached label replaced by the current preferred display label.
- `imagePrompt` and cached image bytes remain unchanged because rendered story images contain no text.

If no reliable source label is available for an unconfigured historical entry, it is not eligible for cross-name reuse because returning stale names would violate the display rule. The currently prewarmed demo entries are covered because their original `示例同学` / `梦中梦` inputs remain in the demo configuration; their images do not need regeneration.

## Testing

Add an API-level regression test using a pre-created cached scene:

- A request with the same photo/story dimensions but a different name and non-empty nickname hits the cache, avoids upstream API calls, and returns the nickname in narrative/choices.
- A request with empty nickname hits the same cache and returns the current name in narrative/choices.
- A differing story dimension such as theme or choice path does not use that cache entry.

## Scope

This change is limited to story cache lookup and response personalization in `server.js`, plus targeted tests and any demo documentation that currently states name or nickname causes a cache miss. It does not change poster generation caching, image generation prompts on cache misses, or the story UI layout.
