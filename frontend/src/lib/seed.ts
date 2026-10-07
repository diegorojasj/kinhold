import { localId } from '@/lib/sync/device';

/**
 * Ids for the demo data a first launch starts with. They are unique per device (not 'hh-home'), because
 * that data syncs like anything else and two phones' demo households must not collide on the server.
 */
export const SEED = {
  household: `hh-${localId}`,
  me: `m-${localId}`,
  sam: `sam-${localId}`,
  noa: `noa-${localId}`,
};
