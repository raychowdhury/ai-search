import type { Db } from "@/db/client";
import { adapterStatus } from "@/lib/platforms/registry";
import type { PlatformId } from "@/lib/platforms/types";
import { capStatus, type CapStatus } from "@/lib/platforms/usage";

export interface PlatformHealth {
  id: PlatformId;
  label: string;
  dataMode: "live" | "demo";
  /** A key is present. Not proof the integration works. */
  configured: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureCode: string | null;
  /** Monthly request cap status; cap 0 means unlimited. */
  monthly: CapStatus;
}

/** Credentials present is not provider health: this adds what actually happened on recent checks. */
export function platformHealth(db: Db): PlatformHealth[] {
  return adapterStatus().map((a) => {
    const ok = db
      .prepare("SELECT completed_at FROM checks WHERE platform = ? AND status = 'success' AND data_mode = 'live' ORDER BY completed_at DESC LIMIT 1")
      .get(a.id) as { completed_at: string } | undefined;
    const bad = db
      .prepare("SELECT completed_at, error_code FROM checks WHERE platform = ? AND status = 'failed' AND data_mode = 'live' ORDER BY completed_at DESC LIMIT 1")
      .get(a.id) as { completed_at: string; error_code: string } | undefined;
    return {
      id: a.id,
      label: a.label,
      dataMode: a.dataMode,
      configured: a.configured,
      lastSuccessAt: ok?.completed_at ?? null,
      lastFailureAt: bad?.completed_at ?? null,
      lastFailureCode: bad?.error_code ?? null,
      monthly: capStatus(db, a.id),
    };
  });
}
