import { createContext, useContext } from 'react';

export type ThemeType = 'light' | 'dark';

export const lightTheme = {
  background: '#f9fafb',
  surface: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  border: '#e5e7eb',
  primary: '#ff9500',
  primaryLight: '#fff4e6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  bookmark: '#fbbf24',
  bookmarkEmpty: '#d1d5db',
  divider: '#e5e7eb',
};

export const darkTheme = {
  background: '#000000',
  surface: '#121212',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textTertiary: '#94a3b8',
  border: '#2a2a2a',
  primary: '#ff9500',
  primaryLight: '#4a2c0a',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  bookmark: '#fbbf24',
  bookmarkEmpty: '#64748b',
  divider: '#2a2a2a',
};

export type Theme = typeof lightTheme;

export const ThemeContext = createContext<{
  theme: ThemeType;
  colors: Theme;
  toggleTheme: () => void;
}>({
  theme: 'light',
  colors: lightTheme,
  toggleTheme: () => {},
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
