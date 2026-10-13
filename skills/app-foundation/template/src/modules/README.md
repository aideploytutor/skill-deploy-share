# modules/

Each system skill puts its code in `src/modules/<system>/` (for example `src/modules/orders/`),
its tables in `src/db/schema/<system>.ts` (exported from `src/db/schema/index.ts`),
and its pages under `src/app/<system>/`. Keep systems separate; connect them through events
(`src/lib/events.ts`).
