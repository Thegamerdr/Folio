# Melo one-app authority

Status: owner-directed convergence authority, 2026-08-15.

This document narrows the implementation model without replacing the Product Constitution or the
Trusted Core truth boundaries.

## One product

- The product is **Melo**.
- The financial app and its phoenix companion are both named Melo; the companion is a feature of
  the app, not a separate product or runtime.
- `apps/mobile` is the only production application runtime.
- Android and iPhone are the first supported platforms and must share the React Native product
  implementation, domain contracts, storage rules and design system.
- Desktop is deferred until the mobile product has proved itself.
- The public website remains a marketing, privacy, support and account-deletion surface.

## Design and implementation authority

- Lovable project `d8323aca-d14c-4f6d-bb89-6d41bcefab7b` is the current UI/UX design laboratory and
  review source. It is not a second web product and it does not own production engines, storage,
  authentication or platform behaviour.
- React Native implements approved Lovable designs using real application state and the canonical
  domain/storage packages. Visual similarity in Lovable is not proof of mobile completion.
- Work from older React Native worktrees, the standalone companion prototype and the local-AI
  experiment must be ported into this branch as reviewed changes. Those directories must not become
  parallel applications.

## Account policy

- Melo's useful Personal core remains local-first and works without sign-in, internet, bank feed or
  model, as required by the Product Constitution.
- An account is required when the user enables a connected feature that needs identity: encrypted
  backup/restore, purchase restoration across installs, Open Banking or another authenticated cloud
  service.
- Sign-in must never imply that local financial data is uploaded. Connected-service copy must state
  exactly what leaves the device and why.
- Lovable/Supabase must not become a second identity or financial-data backend alongside the mobile
  Clerk and Cloudflare architecture.

## Navigation authority

- Personal primary navigation is **Today · Talk to Melo · More**.
- Business primary navigation is **Today · Money · Filings · More**.
- Melo remains a persistent companion and contextual assistant; it is not a Business navigation tab.
- Personal and Business remain separate user-facing workspaces with shared security, truth,
  provenance and design infrastructure.

## Migration rules

1. Start from the clean committed mobile convergence foundation.
2. Preserve existing working behaviour behind adapters while replacing it; do not perform a giant
   rewrite.
3. Port current Lovable design decisions into React Native, never the reverse as a second runtime.
4. Salvage the August local-AI changes feature by feature; do not merge the older dirty branch
   wholesale.
5. Integrate one root-mounted companion engine and one canonical character renderer into mobile.
6. Every financial number must come from real state or be clearly labelled sample data.
7. Provider-dependent features stay visibly unavailable until their production configuration and
   end-to-end evidence exist.
8. Release claims require Android and iPhone evidence; desktop evidence is not part of the first
   release.
