/* The build's real device capabilities.

   This file is the one honest place that answers "what can this binary read?".
   It is not a feature flag to flip optimistically:

     - `BUILD_HEALTH_MODULES` becomes true only in the commit that adds the
       native module (HealthKit / Health Connect) *and* its config plugin, so a
       development build has actually compiled it.
     - `backend` becomes true only when the API is deployed and its OAuth
       callback is reachable. `server/` exists but has never been deployed.
     - `links` is empty because no athlete has completed a handshake yet. A
       link record is written only after a successful handshake + read.

   Until those change, every path correctly resolves to "not in this build",
   "needs backend", or "not implemented" instead of pretending to connect. */

import {
  type DeviceCapabilityContext,
  type DeviceLink,
  type DevicePlatform,
  type ProviderId,
} from '../../domain';

export const BUILD_HEALTH_MODULES = {
  appleHealth: false,
  healthConnect: false,
} as const;

export const BACKEND_DEPLOYED = false;

export function platformName(os: string): DevicePlatform {
  if (os === 'android') return 'android';
  if (os === 'ios') return 'ios';
  return 'web';
}

export interface DeviceContextInput {
  platform: DevicePlatform;
  links?: Partial<Record<ProviderId, DeviceLink>>;
}

export function deviceContext(
  input: DeviceContextInput,
): DeviceCapabilityContext {
  return {
    platform: input.platform,
    modules: { ...BUILD_HEALTH_MODULES },
    backend: BACKEND_DEPLOYED,
    partnerApprovals: [],
    links: input.links ?? {},
  };
}
