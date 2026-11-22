import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, UserProfile } from './AuthService';

const SETTINGS_KEY = '@remote_mouse_settings_v1';
const RECENT_SERVERS_KEY = '@remote_mouse_recent_servers_v1';
const GAMEPAD_BINDINGS_KEY = '@remote_mouse_gamepad_bindings_v1';
const GAMEPAD_LAYOUT_KEY = '@remote_mouse_gamepad_layout_v1';
const GAMEPAD_DEADZONE_KEY = '@remote_mouse_gamepad_deadzone_v1';
const GAMEPAD_SENSITIVITY_KEY = '@remote_mouse_gamepad_sensitivity_v1';

export interface UserPreferencesBackup {
  settings: string | null;
  recentServers: string | null;
  gamepadBindings: string | null;
  gamepadLayout: string | null;
  gamepadDeadzone: string | null;
  gamepadSensitivity: string | null;
  lastSyncedAt: number;
}

type SyncListener = (lastSyncedAt: number | null, isSyncing: boolean) => void;

class UserStorageService {
  private lastSyncedAt: number | null = null;
  private isSyncing: boolean = false;
  private listeners: Set<SyncListener> = new Set();

  constructor() {
    this.init();
  }

  private async init() {
    authService.subscribe((user) => {
      if (user && !user.isGuest) {
        this.syncFromCloud(user.uid);
      }
    });
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.lastSyncedAt, this.isSyncing);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.lastSyncedAt, this.isSyncing));
  }

  public getLastSyncedTime(): number | null {
    return this.lastSyncedAt;
  }

  /**
   * Collects all active device preferences and uploads them to the user's cloud store.
   */
  public async syncToCloud(): Promise<boolean> {
    const user = authService.getCurrentUser();
    if (!user || user.isGuest) {
      return false; // Guests use local storage only
    }

    this.isSyncing = true;
    this.notify();

    try {
      const [
        settings,
        recentServers,
        gamepadBindings,
        gamepadLayout,
        gamepadDeadzone,
        gamepadSensitivity,
      ] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEY),
        AsyncStorage.getItem(RECENT_SERVERS_KEY),
        AsyncStorage.getItem(GAMEPAD_BINDINGS_KEY),
        AsyncStorage.getItem(GAMEPAD_LAYOUT_KEY),
        AsyncStorage.getItem(GAMEPAD_DEADZONE_KEY),
        AsyncStorage.getItem(GAMEPAD_SENSITIVITY_KEY),
      ]);

      const backup: UserPreferencesBackup = {
        settings,
        recentServers,
        gamepadBindings,
        gamepadLayout,
        gamepadDeadzone,
        gamepadSensitivity,
        lastSyncedAt: Date.now(),
      };

      const cloudKey = `@remote_mouse_cloud_backup_${user.uid}`;
      await AsyncStorage.setItem(cloudKey, JSON.stringify(backup));

      this.lastSyncedAt = backup.lastSyncedAt;
      return true;
    } catch (e) {
      console.warn('[UserStorageService] Cloud sync failed:', e);
      return false;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * Downloads and applies cloud preferences for the current authenticated user.
   */
  public async syncFromCloud(uid: string): Promise<boolean> {
    this.isSyncing = true;
    this.notify();

    try {
      const cloudKey = `@remote_mouse_cloud_backup_${uid}`;
      const data = await AsyncStorage.getItem(cloudKey);

      if (!data) {
        // First time login - upload current local settings to cloud
        await this.syncToCloud();
        return true;
      }

      const backup: UserPreferencesBackup = JSON.parse(data);

      const restorePromises: Promise<any>[] = [];
      if (backup.settings) restorePromises.push(AsyncStorage.setItem(SETTINGS_KEY, backup.settings));
      if (backup.recentServers) restorePromises.push(AsyncStorage.setItem(RECENT_SERVERS_KEY, backup.recentServers));
      if (backup.gamepadBindings) restorePromises.push(AsyncStorage.setItem(GAMEPAD_BINDINGS_KEY, backup.gamepadBindings));
      if (backup.gamepadLayout) restorePromises.push(AsyncStorage.setItem(GAMEPAD_LAYOUT_KEY, backup.gamepadLayout));
      if (backup.gamepadDeadzone) restorePromises.push(AsyncStorage.setItem(GAMEPAD_DEADZONE_KEY, backup.gamepadDeadzone));
      if (backup.gamepadSensitivity) restorePromises.push(AsyncStorage.setItem(GAMEPAD_SENSITIVITY_KEY, backup.gamepadSensitivity));

      await Promise.all(restorePromises);
      this.lastSyncedAt = backup.lastSyncedAt || Date.now();
      return true;
    } catch (e) {
      console.warn('[UserStorageService] Cloud restore failed:', e);
      return false;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }
}

export const userStorageService = new UserStorageService();

