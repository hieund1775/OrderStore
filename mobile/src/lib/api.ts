import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Default development API host (10.0.2.2 for Android emulator, localhost for iOS)
const DEFAULT_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || `${DEFAULT_HOST}/api`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // secure store unavailable (e.g. web fallback)
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.response?.data?.message || error.message || 'Lỗi kết nối máy chủ';
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
