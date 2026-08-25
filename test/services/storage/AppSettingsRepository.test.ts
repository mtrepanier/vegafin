const mockStore: Record<string, string> = {};

jest.mock('@amazon-devices/react-native-async-storage__async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStore[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStore[key];
      return Promise.resolve();
    }),
  },
}));

import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';
import { appSettingsRepository } from '../../../src/services/storage/AppSettingsRepository';
import { defaultAppSettings } from '../../../src/services/storage/types';

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  (appSettingsRepository as unknown as { settings: unknown }).settings = defaultAppSettings();
});

describe('init', () => {
  it('returns defaults with nothing persisted yet', async () => {
    const result = await appSettingsRepository.init();
    expect(result).toEqual(defaultAppSettings());
  });

  it('merges persisted values over defaults, so a field added after a save still gets its default', async () => {
    mockStore['vegafin.appSettings.v1'] = JSON.stringify({ showClock: false, skipForwardSec: 15 });

    const result = await appSettingsRepository.init();

    expect(result).toEqual({ ...defaultAppSettings(), showClock: false, skipForwardSec: 15 });
  });

  it('notifies subscribers', async () => {
    const listener = jest.fn();
    appSettingsRepository.subscribe(listener);
    await appSettingsRepository.init();
    expect(listener).toHaveBeenCalled();
  });
});

describe('update', () => {
  it('merges the patch into existing settings and persists the full result', async () => {
    await appSettingsRepository.update({ showClock: false });
    await appSettingsRepository.update({ skipForwardSec: 45 });

    expect(appSettingsRepository.getSnapshot()).toEqual({
      ...defaultAppSettings(),
      showClock: false,
      skipForwardSec: 45,
    });
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      'vegafin.appSettings.v1',
      JSON.stringify({ ...defaultAppSettings(), showClock: false, skipForwardSec: 45 }),
    );
  });

  it('notifies subscribers', async () => {
    const listener = jest.fn();
    appSettingsRepository.subscribe(listener);
    await appSettingsRepository.update({ autoPlayNextUp: false });
    expect(listener).toHaveBeenCalled();
  });
});

describe('subscribe', () => {
  it('stops notifying a listener after it unsubscribes', async () => {
    const listener = jest.fn();
    const unsubscribe = appSettingsRepository.subscribe(listener);
    unsubscribe();

    await appSettingsRepository.update({ showClock: false });

    expect(listener).not.toHaveBeenCalled();
  });
});
