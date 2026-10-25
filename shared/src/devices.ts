/* Device import capability model.

   Why this is pure data instead of a list of buttons: "connect your watch" is
   four different mechanisms with four different blockers, and conflating them
   is how apps end up advertising integrations they do not have.

     1. os_store      — HealthKit / Health Connect. Read-only, no vendor
                        approval, but needs native code compiled into the app.
     2. vendor_cloud  — Garmin / Polar / WHOOP / Suunto / COROS / Oura. Needs a
                        server to hold OAuth tokens and vendor program approval.
     3. import_hub    — Strava. Needs a registered API app + server callback.
     4. file_import   — FIT/TCX/GPX. No backend at all; pure client-side work.
     5. own_watch_app — our own watchOS / Wear OS client. Not started.

   Every provider resolves to exactly one status, and `connected` is only
   reachable from a real link record written after a successful handshake.
   Nothing here guesses availability from a device name. */

export const PROVIDER_IDS = [
  'apple_health',
  'health_connect',
  'garmin',
  'polar',
  'whoop',
  'suunto',
  'coros',
  'oura',
  'strava',
  'file_import',
  'watch_app_ios',
  'watch_app_wear',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type DevicePlatform = 'ios' | 'android' | 'web';

export type Mechanism =
  | 'os_store'
  | 'vendor_cloud'
  | 'import_hub'
  | 'file_import'
  | 'own_watch_app';

export type ProviderStatus =
  /** A completed link exists; the last sync did not fail. */
  | 'connected'
  /** Prerequisites are met and the adapter can be started now. */
  | 'available'
  /** The native module is not compiled into this binary. */
  | 'needs_build'
  /** Requires a server-side OAuth exchange; no backend is deployed. */
  | 'needs_backend'
  /** The vendor must approve API access before tokens can be issued. */
  | 'needs_partner'
  /** The adapter is not written yet. */
  | 'not_implemented'
  /** A link exists but its last sync failed. */
  | 'sync_error'
  /** This platform cannot support the mechanism at all. */
  | 'unsupported';

/** Native module flags are a statement about the build, not a guess. */
export type NativeHealthModule = 'appleHealth' | 'healthConnect';

export interface DeviceLink {
  provider: ProviderId;
  /** ISO timestamp of the completed handshake. */
  connectedAt: string;
  lastSyncAt?: string;
  /** false only when a sync attempt actually failed. */
  lastSyncOk?: boolean;
  /** Scopes the athlete actually granted, as the OS reported them. */
  permissions?: string[];
}

export interface DeviceCapabilityContext {
  platform: DevicePlatform;
  /** Which native health modules are compiled into this binary. */
  modules: Record<NativeHealthModule, boolean>;
  /** True only when a reachable server can complete an OAuth exchange. */
  backend: boolean;
  /** Vendors that have granted program access to LMTLSS. */
  partnerApprovals?: readonly ProviderId[];
  /** Links the athlete actually completed, keyed by provider. */
  links?: Partial<Record<ProviderId, DeviceLink>>;
}

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  mechanism: Mechanism;
  /** Watches/brands whose workouts arrive through this path. */
  covers: string;
  /** What the path can actually read. */
  reads: string;
  /** Platforms where the mechanism can work at all. */
  platforms: readonly DevicePlatform[];
  /** Only os_store paths have a native module. */
  module?: NativeHealthModule;
  requiresBackend: boolean;
  requiresPartnerApproval: boolean;
  /** True only when the client-side adapter exists in this repository. */
  adapterImplemented: boolean;
  /** Plain-language explanation shown even while the provider is blocked. */
  note: string;
}

export interface ProviderResolution {
  id: ProviderId;
  status: ProviderStatus;
  /** Always non-empty; this is what the UI shows under the label. */
  detail: string;
  /** What has to happen before it can connect; null when available/connected. */
  blocker: string | null;
}

export interface MechanismGroup {
  mechanism: Mechanism;
  label: string;
  providers: readonly ProviderSpec[];
}

export const MECHANISM_LABELS: Record<Mechanism, string> = {
  os_store: 'On-device health stores',
  vendor_cloud: 'Vendor cloud APIs',
  import_hub: 'Import hubs',
  file_import: 'File import',
  own_watch_app: 'LMTLSS watch apps',
};

export const STATUS_LABELS: Record<ProviderStatus, string> = {
  connected: 'Connected',
  available: 'Ready to connect',
  needs_build: 'Not in this build',
  needs_backend: 'Needs backend',
  needs_partner: 'Needs partner approval',
  not_implemented: 'Not implemented',
  sync_error: 'Sync failed',
  unsupported: 'Unsupported here',
};

export const DEVICE_PROVIDERS: readonly ProviderSpec[] = [
  {
    id: 'apple_health',
    label: 'Apple Health',
    mechanism: 'os_store',
    covers: 'Apple Watch, iPhone, and any watch app that writes to Apple Health',
    reads: 'Finished workouts: sport, start time, duration, distance, energy, heart rate',
    platforms: ['ios'],
    module: 'appleHealth',
    requiresBackend: false,
    requiresPartnerApproval: false,
    adapterImplemented: false,
    note: 'Read-only. Strength workouts arrive without sets, reps, or load — LMTLSS never invents them.',
  },
  {
    id: 'health_connect',
    label: 'Health Connect',
    mechanism: 'os_store',
    covers: 'Wear OS watches (Pixel, Galaxy Watch, TicWatch) and Android apps that write workouts',
    reads: 'Finished workouts: sport, start time, duration, distance, energy, heart rate',
    platforms: ['android'],
    module: 'healthConnect',
    requiresBackend: false,
    requiresPartnerApproval: false,
    adapterImplemented: false,
    note: 'Read-only. On Android 14+ Health Connect is part of the OS; older versions need the Health Connect app.',
  },
  {
    id: 'garmin',
    label: 'Garmin',
    mechanism: 'vendor_cloud',
    covers: 'Garmin watches, Edge bike computers, and Garmin Connect activities',
    reads: 'Activities, daily summaries; writing planned workouts needs a separate permission',
    platforms: ['ios', 'android'],
    requiresBackend: true,
    requiresPartnerApproval: true,
    adapterImplemented: false,
    note: 'Garmin Health API access is granted to approved partners only.',
  },
  {
    id: 'polar',
    label: 'Polar',
    mechanism: 'vendor_cloud',
    covers: 'Polar watches and the Polar Flow training diary',
    reads: 'Training sessions and daily activity summaries',
    platforms: ['ios', 'android', 'web'],
    requiresBackend: true,
    requiresPartnerApproval: true,
    adapterImplemented: false,
    note: 'Polar AccessLink requires a registered client and a server-side token exchange.',
  },
  {
    id: 'whoop',
    label: 'WHOOP',
    mechanism: 'vendor_cloud',
    covers: 'WHOOP strap (recovery, strain, sleep, workouts)',
    reads: 'Workouts, recovery, sleep; no GPS route by default',
    platforms: ['ios', 'android', 'web'],
    requiresBackend: true,
    requiresPartnerApproval: true,
    adapterImplemented: false,
    note: 'WHOOP issues API credentials to approved developers only.',
  },
  {
    id: 'suunto',
    label: 'Suunto',
    mechanism: 'vendor_cloud',
    covers: 'Suunto watches and the Suunto app training log',
    reads: 'Workouts with duration, distance, and heart rate',
    platforms: ['ios', 'android', 'web'],
    requiresBackend: true,
    requiresPartnerApproval: true,
    adapterImplemented: false,
    note: 'Suunto partner API access is not open to unregistered apps.',
  },
  {
    id: 'coros',
    label: 'COROS',
    mechanism: 'vendor_cloud',
    covers: 'COROS watches and the COROS training log',
    reads: 'Workouts with duration, distance, and heart rate',
    platforms: ['ios', 'android', 'web'],
    requiresBackend: true,
    requiresPartnerApproval: true,
    adapterImplemented: false,
    note: 'COROS has no open public API; access is partner-only. Strava import covers COROS today.',
  },
  {
    id: 'oura',
    label: 'Oura',
    mechanism: 'vendor_cloud',
    covers: 'Oura Ring (sleep and readiness, not workouts)',
    reads: 'Sleep, readiness, and temperature trends — not training sessions',
    platforms: ['ios', 'android', 'web'],
    requiresBackend: true,
    requiresPartnerApproval: true,
    adapterImplemented: false,
    note: 'Oura is a recovery source, not a workout source. It would never appear as a training import.',
  },
  {
    id: 'strava',
    label: 'Strava',
    mechanism: 'import_hub',
    covers: 'Garmin, COROS, Suunto, Polar, Wahoo, Zwift, and Apple Watch via the Strava app',
    reads: 'Activities with sport, duration, distance, and elevation',
    platforms: ['ios', 'android', 'web'],
    requiresBackend: true,
    requiresPartnerApproval: true,
    adapterImplemented: false,
    note: 'Strava API apps are registered per developer and require a server callback.',
  },
  {
    id: 'file_import',
    label: 'FIT / TCX / GPX file',
    mechanism: 'file_import',
    covers: 'Any device that can export a file — no vendor account required',
    reads: 'Workouts parsed on the device; nothing is uploaded',
    platforms: ['ios', 'android'],
    requiresBackend: false,
    requiresPartnerApproval: false,
    adapterImplemented: true,
    note: 'The only path that works without a backend. Nothing is uploaded; parsing happens locally on the phone.',
  },
  {
    id: 'watch_app_ios',
    label: 'LMTLSS for Apple Watch',
    mechanism: 'own_watch_app',
    covers: 'watchOS companion app with live sets and heart rate on the wrist',
    reads: 'Our own live session, not a third-party history',
    platforms: ['ios'],
    requiresBackend: false,
    requiresPartnerApproval: false,
    adapterImplemented: false,
    note: 'A watchOS target is not part of the current build.',
  },
  {
    id: 'watch_app_wear',
    label: 'LMTLSS for Wear OS',
    mechanism: 'own_watch_app',
    covers: 'Wear OS companion app with live sets and heart rate on the wrist',
    reads: 'Our own live session, not a third-party history',
    platforms: ['android'],
    requiresBackend: false,
    requiresPartnerApproval: false,
    adapterImplemented: false,
    note: 'A Wear OS target is not part of the current build.',
  },
];

const PROVIDER_INDEX: Record<ProviderId, ProviderSpec> = DEVICE_PROVIDERS.reduce(
  (acc, spec) => {
    acc[spec.id] = spec;
    return acc;
  },
  {} as Record<ProviderId, ProviderSpec>,
);

export function providerById(id: ProviderId): ProviderSpec {
  return PROVIDER_INDEX[id];
}

const PLATFORM_NAMES: Record<DevicePlatform, string> = {
  ios: 'iOS',
  android: 'Android',
  web: 'the web',
};

const MODULE_NAMES: Record<NativeHealthModule, string> = {
  appleHealth: 'HealthKit',
  healthConnect: 'Health Connect',
};

function platformList(platforms: readonly DevicePlatform[]): string {
  const names = platforms.map((platform) => PLATFORM_NAMES[platform]);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

function isApproved(spec: ProviderSpec, ctx: DeviceCapabilityContext): boolean {
  if (!spec.requiresPartnerApproval) return true;
  return (ctx.partnerApprovals ?? []).includes(spec.id);
}

function connectedDetail(link: DeviceLink, ctx: DeviceCapabilityContext): string {
  const when = link.lastSyncAt ?? link.connectedAt;
  if (link.lastSyncOk === false) {
    return `Last sync failed on ${when}. Data from this source may be stale.`;
  }
  if (link.lastSyncAt) {
    return `Last synced ${link.lastSyncAt} on ${PLATFORM_NAMES[ctx.platform]}.`;
  }
  return `Connected on ${link.connectedAt}. No sync has run yet.`;
}

/* Resolution order matters: the first true statement is the one the athlete
   sees, so platform impossibility beats a missing build, and a failed sync
   beats a stale "connected" claim. */
export function resolveProvider(
  spec: ProviderSpec,
  ctx: DeviceCapabilityContext,
): ProviderResolution {
  const linked = ctx.links?.[spec.id];

  if (!spec.platforms.includes(ctx.platform)) {
    return {
      id: spec.id,
      status: 'unsupported',
      detail: `${spec.label} works on ${platformList(spec.platforms)}. This build is running on ${PLATFORM_NAMES[ctx.platform]}.`,
      blocker: `Requires ${platformList(spec.platforms)}.`,
    };
  }

  if (linked) {
    if (linked.lastSyncOk === false) {
      return {
        id: spec.id,
        status: 'sync_error',
        detail: connectedDetail(linked, ctx),
        blocker: 'Re-authorise the connection, then run a sync.',
      };
    }
    return {
      id: spec.id,
      status: 'connected',
      detail: connectedDetail(linked, ctx),
      blocker: null,
    };
  }

  if (spec.module && !ctx.modules[spec.module]) {
    return {
      id: spec.id,
      status: 'needs_build',
      detail: `${MODULE_NAMES[spec.module]} is not compiled into this build, so there is nothing to ask permission from.`,
      blocker: `Ship a development build that includes ${MODULE_NAMES[spec.module]}.`,
    };
  }

  if (spec.requiresBackend && !ctx.backend) {
    return {
      id: spec.id,
      status: 'needs_backend',
      detail: 'Requires a server-side token exchange. No backend is deployed, so this cannot connect.',
      blocker: 'Deploy the API and its OAuth callback before this can be offered.',
    };
  }

  if (!isApproved(spec, ctx)) {
    return {
      id: spec.id,
      status: 'needs_partner',
      detail: `${spec.label} has not granted LMTLSS API access, so no token can be issued.`,
      blocker: `Apply to the ${spec.label} partner programme.`,
    };
  }

  if (!spec.adapterImplemented) {
    return {
      id: spec.id,
      status: 'not_implemented',
      detail: 'Prerequisites are met, but the adapter is not written yet. Listed so the gap stays visible.',
      blocker: 'Write and test the adapter.',
    };
  }

  return {
    id: spec.id,
    status: 'available',
    detail:
      spec.mechanism === 'file_import'
        ? 'Ready to import a file. Nothing is read until you pick one.'
        : 'Ready to request permission. Nothing is read until you approve it.',
    blocker: null,
  };
}

export function resolveProviders(
  ctx: DeviceCapabilityContext,
): readonly ProviderResolution[] {
  return DEVICE_PROVIDERS.map((spec) => resolveProvider(spec, ctx));
}

export function providersByMechanism(): readonly MechanismGroup[] {
  const order: Mechanism[] = [
    'os_store',
    'vendor_cloud',
    'import_hub',
    'file_import',
    'own_watch_app',
  ];
  return order.map((mechanism) => ({
    mechanism,
    label: MECHANISM_LABELS[mechanism],
    providers: DEVICE_PROVIDERS.filter((spec) => spec.mechanism === mechanism),
  }));
}

export interface ProviderSummary {
  total: number;
  connected: number;
  available: number;
  blocked: number;
}

export function summarizeProviders(
  resolutions: readonly ProviderResolution[],
): ProviderSummary {
  return resolutions.reduce<ProviderSummary>(
    (acc, row) => {
      acc.total += 1;
      if (row.status === 'connected') acc.connected += 1;
      else if (row.status === 'available') acc.available += 1;
      else acc.blocked += 1;
      return acc;
    },
    { total: 0, connected: 0, available: 0, blocked: 0 },
  );
}

/** Runtime guard for payloads that did not come from our own types. */
export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value);
}
