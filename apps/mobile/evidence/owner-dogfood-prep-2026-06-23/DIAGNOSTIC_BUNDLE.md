# Diagnostic Bundle Description

Dogfood diagnostic export is local-only and redacted by default.

Export path in the app:

```text
More -> Dogfood mode -> Export diagnostic
```

Files written:

```text
folio-dogfood-diagnostic-YYYY-MM-DD.json
folio-dogfood-diagnostic-YYYY-MM-DD.md
```

Included:

- app version/build info;
- device/runtime info where available;
- current screen/route summary;
- canonical object counts;
- workspace state;
- recent audit log metadata;
- recent decision record metadata;
- import/review state;
- plan/recovery state;
- Melo proposal count;
- rejected evidence count;
- dogfood/feature flags;
- last 20 non-sensitive app events when available.

Excluded:

- raw financial rows;
- raw statement/source text;
- account details;
- personal identifiers;
- conversation text;
- provider tokens;
- cloud or AI payloads.

The implementation lives in:

- `apps/mobile/src/local/dogfoodMode.ts`
- `apps/mobile/src/local/nativeDogfoodDiagnosticExport.ts`
