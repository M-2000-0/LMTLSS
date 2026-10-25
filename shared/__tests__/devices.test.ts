import {
  DEVICE_PROVIDERS,
  MECHANISM_LABELS,
  PROVIDER_IDS,
  STATUS_LABELS,
  isProviderId,
  providerById,
  providersByMechanism,
  resolveProvider,
  resolveProviders,
  summarizeProviders,
  type DeviceCapabilityContext,
  type ProviderSpec,
  type ProviderStatus,
} from '../src/devices';

const IOS_EMPTY: DeviceCapabilityContext = {
  platform: 'ios',
  modules: { appleHealth: false, healthConnect: false },
  backend: false,
};

const ANDROID_EMPTY: DeviceCapabilityContext = {
  platform: 'android',
  modules: { appleHealth: false, healthConnect: false },
  backend: false,
};

const ALL_STATUSES: ProviderStatus[] = [
  'connected',
  'available',
  'needs_build',
  'needs_backend',
  'needs_partner',
  'not_implemented',
  'sync_error',
  'unsupported',
];

describe('device catalogue', () => {
  it('has a unique id for every provider and a label for every status', () => {
    expect(new Set(PROVIDER_IDS).size).toBe(PROVIDER_IDS.length);
    expect(DEVICE_PROVIDERS.map((spec) => spec.id)).toEqual([...PROVIDER_IDS]);
    for (const status of ALL_STATUSES) {
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it('groups every provider exactly once, in mechanism order', () => {
    const groups = providersByMechanism();
    const ids = groups.flatMap((group) => group.providers.map((spec) => spec.id));
    expect(ids.slice().sort()).toEqual([...PROVIDER_IDS].sort());
    expect(new Set(ids).size).toBe(PROVIDER_IDS.length);
    expect(groups.map((group) => group.label)).toEqual([
      MECHANISM_LABELS.os_store,
      MECHANISM_LABELS.vendor_cloud,
      MECHANISM_LABELS.import_hub,
      MECHANISM_LABELS.file_import,
      MECHANISM_LABELS.own_watch_app,
    ]);
  });

  it('looks providers up by id and rejects unknown ids at runtime', () => {
    expect(providerById('garmin').label).toBe('Garmin');
    expect(isProviderId('strava')).toBe(true);
    expect(isProviderId('nike_run_club')).toBe(false);
    expect(isProviderId(null)).toBe(false);
  });
});

describe('capability resolution', () => {
  it('marks iOS-only and Android-only paths unsupported on the wrong platform', () => {
    const ios = resolveProviders(IOS_EMPTY);
    const android = resolveProviders(ANDROID_EMPTY);
    const status = (rows: typeof ios, id: (typeof PROVIDER_IDS)[number]) =>
      rows.find((row) => row.id === id)?.status;

    expect(status(ios, 'health_connect')).toBe('unsupported');
    expect(status(android, 'apple_health')).toBe('unsupported');
    expect(status(ios, 'apple_health')).not.toBe('unsupported');
    expect(status(android, 'health_connect')).not.toBe('unsupported');

    const unsupported = ios.find((row) => row.id === 'health_connect');
    expect(unsupported?.detail).toContain('Android');
    expect(unsupported?.blocker).toContain('Android');
  });

  it('says "not in this build" when the native module is absent — never "available"', () => {
    const rows = resolveProviders(IOS_EMPTY);
    const apple = rows.find((row) => row.id === 'apple_health');
    expect(apple?.status).toBe('needs_build');
    expect(apple?.detail).toContain('HealthKit');
    expect(apple?.blocker).toContain('development build');
  });

  it('stays honest when the module is present but no adapter exists', () => {
    const rows = resolveProviders({
      ...IOS_EMPTY,
      modules: { appleHealth: true, healthConnect: false },
    });
    const apple = rows.find((row) => row.id === 'apple_health');
    expect(apple?.status).toBe('not_implemented');
    expect(apple?.detail).toContain('adapter is not written');
  });

  it('reports the missing backend before the missing vendor approval', () => {
    const garmin = resolveProviders(IOS_EMPTY).find((row) => row.id === 'garmin');
    expect(garmin?.status).toBe('needs_backend');
    expect(garmin?.detail).toContain('token exchange');
  });

  it('reports partner approval once a backend exists', () => {
    const garmin = resolveProviders({
      ...IOS_EMPTY,
      backend: true,
    }).find((row) => row.id === 'garmin');
    expect(garmin?.status).toBe('needs_partner');
    expect(garmin?.detail).toContain('Garmin');
  });

  it('does not treat a written adapter as approved', () => {
    const garmin = resolveProviders({
      ...IOS_EMPTY,
      backend: true,
      partnerApprovals: ['garmin'],
    }).find((row) => row.id === 'garmin');
    expect(garmin?.status).toBe('not_implemented');
  });

  it('only reaches "available" when platform, prerequisites and adapter all exist', () => {
    const synthetic: ProviderSpec = {
      id: 'file_import',
      label: 'Synthetic',
      mechanism: 'file_import',
      covers: '',
      reads: '',
      platforms: ['ios'],
      requiresBackend: false,
      requiresPartnerApproval: false,
      adapterImplemented: true,
      note: '',
    };
    expect(resolveProvider(synthetic, IOS_EMPTY).status).toBe('available');
    expect(resolveProvider({ ...synthetic, platforms: ['web'] }, IOS_EMPTY).status).toBe(
      'unsupported',
    );
  });

  it('never reports connected without a real link record', () => {
    const rows = resolveProviders({
      ...IOS_EMPTY,
      modules: { appleHealth: true, healthConnect: true },
      backend: true,
    });
    expect(rows.some((row) => row.status === 'connected')).toBe(false);
  });

  it('reports connected only from a link, and flags a failed last sync', () => {
    const connected = resolveProvider(providerById('apple_health'), {
      ...IOS_EMPTY,
      links: {
        apple_health: {
          provider: 'apple_health',
          connectedAt: '2026-10-01T09:00:00.000Z',
          lastSyncAt: '2026-10-20T07:00:00.000Z',
          lastSyncOk: true,
        },
      },
    });
    expect(connected.status).toBe('connected');
    expect(connected.detail).toContain('2026-10-20');

    const failed = resolveProvider(providerById('apple_health'), {
      ...IOS_EMPTY,
      links: {
        apple_health: {
          provider: 'apple_health',
          connectedAt: '2026-10-01T09:00:00.000Z',
          lastSyncAt: '2026-10-20T07:00:00.000Z',
          lastSyncOk: false,
        },
      },
    });
    expect(failed.status).toBe('sync_error');
    expect(failed.detail).toContain('failed');
    expect(failed.blocker).not.toBeNull();
  });

  it('counts the file importer as the one usable path and every other path as blocked', () => {
    const rows = resolveProviders(IOS_EMPTY);
    const summary = summarizeProviders(rows);
    expect(summary.total).toBe(PROVIDER_IDS.length);
    expect(summary.connected).toBe(0);
    expect(summary.available).toBe(1);
    expect(summary.blocked).toBe(PROVIDER_IDS.length - 1);
    expect(rows.filter((row) => row.status === 'available').map((row) => row.id)).toEqual([
      'file_import',
    ]);
  });

  it('offers no other provider as usable on any platform', () => {
    for (const platform of ['ios', 'android', 'web'] as const) {
      const rows = resolveProviders({ ...IOS_EMPTY, platform });
      const available = rows.filter((row) => row.status === 'available').map((row) => row.id);
      expect(available).toEqual(platform === 'web' ? [] : ['file_import']);
    }
  });

  it('marks file import unsupported on web, where the native reader does not exist', () => {
    const row = resolveProviders({ ...IOS_EMPTY, platform: 'web' }).find(
      (entry) => entry.id === 'file_import',
    );
    expect(row?.status).toBe('unsupported');
  });

  it('describes file import as an import, not a permission request', () => {
    const row = resolveProviders(IOS_EMPTY).find((entry) => entry.id === 'file_import');
    expect(row?.status).toBe('available');
    expect(row?.detail).toMatch(/pick one/i);
    expect(row?.blocker).toBeNull();
  });

  it('gives every blocked provider an actionable blocker line', () => {
    for (const row of resolveProviders(IOS_EMPTY)) {
      expect(row.detail.length).toBeGreaterThan(0);
      if (row.status !== 'connected' && row.status !== 'available') {
        expect(row.blocker).toBeTruthy();
      }
    }
  });
});
