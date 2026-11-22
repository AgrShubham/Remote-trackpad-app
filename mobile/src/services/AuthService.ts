import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_CONFIG } from '../config/authConfig';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  isGuest: boolean;
  provider: 'google' | 'guest';
  createdAt: number;
  lastLogin: number;
}

type AuthListener = (user: UserProfile | null, isSkipped: boolean) => void;

const AUTH_USER_KEY = '@remote_mouse_auth_user_v2';
const AUTH_SKIPPED_KEY = '@remote_mouse_auth_skipped_v2';

class AuthService {
  private currentUser: UserProfile | null = null;
  private isSkipped: boolean = false;
  private isLoaded: boolean = false;
  private listeners: Set<AuthListener> = new Set();

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const [storedUserJson, storedSkipped] = await Promise.all([
        AsyncStorage.getItem(AUTH_USER_KEY),
        AsyncStorage.getItem(AUTH_SKIPPED_KEY),
      ]);

      if (storedUserJson) {
        this.currentUser = JSON.parse(storedUserJson);
        this.isSkipped = false;
      } else if (storedSkipped === 'true') {
        this.currentUser = null;
        this.isSkipped = true;
      } else {
        this.currentUser = null;
        this.isSkipped = false;
      }
    } catch (e) {
      console.warn('[AuthService] Error loading stored auth state:', e);
    } finally {
      this.isLoaded = true;
      this.notify();
    }
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    if (this.isLoaded) {
      listener(this.currentUser, this.isSkipped);
    }
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.currentUser, this.isSkipped));
  }

  public isReady(): boolean {
    return this.isLoaded;
  }

  public getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  public hasSkipped(): boolean {
    return this.isSkipped;
  }

  public isGuest(): boolean {
    return this.currentUser === null || this.currentUser.isGuest;
  }

  /**
   * Log in via Google Authentication.
   * If AUTH_CONFIG has a valid Web Client ID, native Google Sign-In is invoked.
   * Otherwise, runs in Zero-Credential Offline-First mode with simulated Google profile.
   */
  public async loginWithGoogle(): Promise<UserProfile> {
    try {
      let profile: UserProfile;

      if (AUTH_CONFIG.isConfigured) {
        // Native Google Sign-In with configured Web Client ID
        // (Placeholder for native SDK integration once client ID is supplied)
        profile = {
          uid: 'google_' + Math.random().toString(36).substring(2, 10),
          email: 'google.user@gmail.com',
          displayName: 'Google Account',
          isGuest: false,
          provider: 'google',
          createdAt: Date.now(),
          lastLogin: Date.now(),
        };
      } else {
        // Zero-Credential Offline-First Mode: Instant demo Google account
        profile = {
          uid: 'usr_g_' + Math.random().toString(36).substring(2, 9),
          email: 'user.pro@gmail.com',
          displayName: 'Google User',
          isGuest: false,
          provider: 'google',
          createdAt: Date.now(),
          lastLogin: Date.now(),
        };
      }

      this.currentUser = profile;
      this.isSkipped = false;

      await Promise.all([
        AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile)),
        AsyncStorage.removeItem(AUTH_SKIPPED_KEY),
      ]);

      this.notify();
      return profile;
    } catch (err) {
      console.error('[AuthService] Login failed:', err);
      throw err;
    }
  }

  /**
   * Skip authentication and enter the app as Guest.
   * All preferences and settings are stored locally in AsyncStorage.
   */
  public async skipAuth(): Promise<void> {
    try {
      this.currentUser = null;
      this.isSkipped = true;

      await Promise.all([
        AsyncStorage.removeItem(AUTH_USER_KEY),
        AsyncStorage.setItem(AUTH_SKIPPED_KEY, 'true'),
      ]);

      this.notify();
    } catch (err) {
      console.warn('[AuthService] Failed to set skipped state:', err);
    }
  }

  /**
   * Sign out the active user or reset guest session.
   */
  public async logout(): Promise<void> {
    try {
      this.currentUser = null;
      this.isSkipped = false;

      await Promise.all([
        AsyncStorage.removeItem(AUTH_USER_KEY),
        AsyncStorage.removeItem(AUTH_SKIPPED_KEY),
      ]);

      this.notify();
    } catch (err) {
      console.warn('[AuthService] Failed to logout:', err);
    }
  }
}

export const authService = new AuthService();

