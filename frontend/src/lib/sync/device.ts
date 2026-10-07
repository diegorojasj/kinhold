import { load, onOtherTab, save, uid } from '@/lib/persist';

interface DeviceState {
  /** Made on first launch, before the device was ever online; demo data ids derive from it (lib/seed.ts). */
  localId: string;
  /** Issued by household-service the first time the device is online. */
  deviceId?: string;
  token?: string;
}

const KEY = 'device';
let state: DeviceState = load<DeviceState>(KEY) ?? { localId: uid() };
save(KEY, state);
onOtherTab(KEY, () => reloadDevice());

export const localId = state.localId;

export const token = () => state.token;

export function reloadDevice() {
  state = load<DeviceState>(KEY) ?? state;
}

export function setCredentials(deviceId: string, token: string) {
  state = { ...state, deviceId, token };
  save(KEY, state);
}
