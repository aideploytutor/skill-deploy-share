import { getDb, isDbConfigured } from "@/db";
import { coreEvents } from "@/db/schema";

export type AppEvent = {
  type: `${string}.${string}`; // "<system>.<event>"
  source: string; // skill name
  subjectId?: string;
  payload?: Record<string, unknown>;
};

/** Record that something happened so other systems can react to it. */
export async function emitEvent(event: AppEvent): Promise<void> {
  if (!isDbConfigured()) {
    console.warn(`[events] ${event.type} not stored: no database yet (episode 003).`);
    return;
  }
  await getDb().insert(coreEvents).values({
    type: event.type,
    source: event.source,
    subjectId: event.subjectId ?? null,
    payload: event.payload ?? {},
  });
}
