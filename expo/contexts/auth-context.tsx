import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import bcrypt from 'bcryptjs';

import { setCurrentUserId } from '@/lib/db/core';
import { secureStorage } from '@/lib/secure-storage';

async function generateToken(userId: string): Promise<string> {
  const random = await Crypto.getRandomBytesAsync(32);
  const hex = Array.from(random).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${userId}.${hex}`;
}

const AUTH_STORAGE_KEY = '@alchemize_auth';
const AUTH_SECURE_KEY = 'alchemize_auth_session';
const REMEMBER_ME_KEY = '@alchemize_remember_me';
const USERS_STORAGE_KEY = '@alchemize_users';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
}

interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  /** @deprecated legacy plaintext field from before password hashing was added; migrated on next successful login */
  password?: string;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
  });
  const [rememberMe, setRememberMeState] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    void loadAuthState().finally(() => setIsLoading(false));
  }, []);

  const loadAuthState = async () => {
    try {
      console.log('[Auth] Loading auth state...');
      let [storedAuth, storedRememberMe] = await Promise.all([
        secureStorage.getItem(AUTH_SECURE_KEY),
        AsyncStorage.getItem(REMEMBER_ME_KEY).catch(() => null),
      ]);

      if (!storedAuth) {
        const legacyAuth = await AsyncStorage.getItem(AUTH_STORAGE_KEY).catch(() => null);
        if (legacyAuth) {
          console.log('[Auth] Migrating legacy auth to secure storage');
          storedAuth = legacyAuth;
          await secureStorage.setItem(AUTH_SECURE_KEY, legacyAuth);
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
        }
      }

      if (storedAuth && typeof storedAuth === 'string' && storedAuth.trim().startsWith('{')) {
        try {
          const auth = JSON.parse(storedAuth) as AuthState;
          if (auth && typeof auth === 'object' && auth.user && typeof auth.user === 'object') {
            setAuthState(auth);
            setCurrentUserId(auth.user.id);
            console.log('[Auth] Auth state loaded successfully:', auth.user?.email);
            console.log('[Auth] Current user ID restored:', auth.user.id);
          } else {
            console.warn('[Auth] Invalid auth structure, clearing');
            await secureStorage.removeItem(AUTH_SECURE_KEY);
          }
        } catch (parseError) {
          console.warn('[Auth] Invalid auth JSON, clearing:', parseError);
          await secureStorage.removeItem(AUTH_SECURE_KEY);
          await AsyncStorage.removeItem(USERS_STORAGE_KEY).catch(() => {});
        }
      } else if (storedAuth) {
        console.warn('[Auth] Corrupted auth data detected, clearing all');
        await secureStorage.removeItem(AUTH_SECURE_KEY);
        await AsyncStorage.multiRemove([USERS_STORAGE_KEY, REMEMBER_ME_KEY]).catch(() => {});
      } else {
        console.log('[Auth] No stored auth found');
      }

      if (storedRememberMe === 'true') {
        setRememberMeState(true);
      }
    } catch (error) {
      console.error('[Auth] Error loading auth state:', error);
      await AsyncStorage.multiRemove([AUTH_STORAGE_KEY, USERS_STORAGE_KEY, REMEMBER_ME_KEY]).catch(() => {});
    }
  };

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    try {
      console.log('[Auth] Logging in:', email);
      
      const usersData = await AsyncStorage.getItem(USERS_STORAGE_KEY);
      let users: StoredUser[] = [];
      if (usersData && typeof usersData === 'string' && usersData.trim().startsWith('[')) {
        try {
          users = JSON.parse(usersData) as StoredUser[];
        } catch {
          console.warn('[Auth] Corrupted users data, resetting');
          users = [];
        }
      }
      
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!user) {
        return { success: false, error: 'User not found. Please sign up first.' };
      }

      let isValid: boolean;
      if (user.passwordHash) {
        isValid = await bcrypt.compare(password, user.passwordHash);
      } else {
        // Legacy account created before password hashing was added.
        isValid = user.password === password;
        if (isValid) {
          user.passwordHash = await bcrypt.hash(password, 10);
          delete user.password;
          await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        }
      }

      if (!isValid) {
        return { success: false, error: 'Invalid password' };
      }

      const token = await generateToken(user.id);
      const newAuthState: AuthState = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      };
      
      setAuthState(newAuthState);
      setRememberMeState(remember);
      
      setCurrentUserId(user.id);
      console.log('[Auth] Current user ID set after login:', user.id);

      await secureStorage.setItem(AUTH_SECURE_KEY, JSON.stringify(newAuthState));
      await AsyncStorage.setItem(REMEMBER_ME_KEY, remember.toString());

      console.log('[Auth] Login successful');
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    try {
      console.log('[Auth] Signing up:', email);

      const usersData = await AsyncStorage.getItem(USERS_STORAGE_KEY);
      let users: StoredUser[] = [];
      if (usersData && typeof usersData === 'string' && usersData.trim().startsWith('[')) {
        try {
          users = JSON.parse(usersData) as StoredUser[];
        } catch {
          console.warn('[Auth] Corrupted users data, resetting');
          users = [];
        }
      }
      
      const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        return { success: false, error: 'User already exists' };
      }
      
      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const passwordHash = await bcrypt.hash(password, 10);
      const newUser: StoredUser = {
        id: userId,
        email,
        name,
        passwordHash,
      };

      users.push(newUser);
      await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

      const token = await generateToken(userId);
      const newAuthState: AuthState = {
        user: {
          id: userId,
          email,
          name,
        },
        token,
      };
      
      setAuthState(newAuthState);
      
      setCurrentUserId(userId);
      console.log('[Auth] Current user ID set after signup:', userId);

      await secureStorage.setItem(AUTH_SECURE_KEY, JSON.stringify(newAuthState));

      console.log('[Auth] Signup successful');
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Signup error:', error);
      return { success: false, error: error.message || 'Signup failed' };
    }
  }, []);

  const loginWithApple = useCallback(async () => {
    try {
      console.log('[Auth] Starting Apple Sign In...');

      if (Platform.OS === 'web') {
        return { success: false, error: 'Apple Sign In is not available on web' };
      }

      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Apple Sign In is not available on this device' };
      }

      const nonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString(36).substring(2, 15)
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });

      console.log('[Auth] Apple credential received:', credential.user);

      const appleUserId = `apple_${credential.user}`;
      const appleEmail = credential.email || `${credential.user}@privaterelay.appleid.com`;
      const appleName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ') || 'Apple User'
        : 'Apple User';

      const usersData = await AsyncStorage.getItem(USERS_STORAGE_KEY);
      let users: StoredUser[] = [];
      if (usersData && typeof usersData === 'string' && usersData.trim().startsWith('[')) {
        try {
          users = JSON.parse(usersData) as StoredUser[];
        } catch {
          console.warn('[Auth] Corrupted users data, resetting');
          users = [];
        }
      }

      let existingUser = users.find(u => u.id === appleUserId);
      if (!existingUser) {
        const newUser: StoredUser = {
          id: appleUserId,
          email: appleEmail,
          name: appleName,
        };
        users.push(newUser);
        await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        existingUser = newUser;
        console.log('[Auth] New Apple user created:', appleUserId);
      } else {
        if (credential.fullName?.givenName) {
          existingUser.name = appleName;
          await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        }
      }

      const token = await generateToken(existingUser.id);
      const newAuthState: AuthState = {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        },
        token,
      };

      setAuthState(newAuthState);
      setCurrentUserId(existingUser.id);
      console.log('[Auth] Apple Sign In successful:', existingUser.email);

      await secureStorage.setItem(AUTH_SECURE_KEY, JSON.stringify(newAuthState));

      return { success: true };
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        console.log('[Auth] Apple Sign In cancelled by user');
        return { success: false, error: 'Sign in was cancelled' };
      }
      console.error('[Auth] Apple Sign In error:', error);
      return { success: false, error: error.message || 'Apple Sign In failed' };
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      console.log('[Auth] Password reset requested for:', email);
      const usersData = await AsyncStorage.getItem(USERS_STORAGE_KEY);
      let users: StoredUser[] = [];
      if (usersData && typeof usersData === 'string' && usersData.trim().startsWith('[')) {
        try {
          users = JSON.parse(usersData) as StoredUser[];
        } catch {
          console.warn('[Auth] Corrupted users data, resetting');
          users = [];
        }
      }
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        return { success: false, error: 'No account found with that email' };
      }
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Password reset error:', error);
      return { success: false, error: error.message || 'Password reset failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      console.log('[Auth] Logging out');
      setAuthState({ user: null, token: null });
      
      setCurrentUserId(null);
      console.log('[Auth] Current user ID cleared');
      
      await secureStorage.removeItem(AUTH_SECURE_KEY);
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
      await AsyncStorage.removeItem(REMEMBER_ME_KEY);

      console.log('[Auth] Logout successful');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  }, []);

  return useMemo(() => ({
    user: authState.user,
    token: authState.token,
    isAuthenticated: !!authState.user,
    isLoading,
    rememberMe,
    login,
    signup,
    loginWithApple,
    resetPassword,
    logout,
  }), [authState.user, authState.token, isLoading, rememberMe, login, signup, loginWithApple, resetPassword, logout]);
});
