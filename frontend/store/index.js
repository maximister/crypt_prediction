import { configureStore } from '@reduxjs/toolkit';
import widgetSettingsReducer from './widgetSettingsSlice';

export const store = configureStore({
  reducer: {
    widgetSettings: widgetSettingsReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
}); 