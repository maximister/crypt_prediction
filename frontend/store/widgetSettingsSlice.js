import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  widgets: {},
};

export const widgetSettingsSlice = createSlice({
  name: 'widgetSettings',
  initialState,
  reducers: {
    updateWidgetSettings: (state, action) => {
      const { widgetId, settings } = action.payload;
      state.widgets[widgetId] = {
        ...state.widgets[widgetId],
        ...settings,
      };
    },
    resetWidgetSettings: (state, action) => {
      const { widgetId } = action.payload;
      delete state.widgets[widgetId];
    },
    resetAllWidgetSettings: (state) => {
      state.widgets = {};
    },
  },
});

export const { 
  updateWidgetSettings, 
  resetWidgetSettings, 
  resetAllWidgetSettings 
} = widgetSettingsSlice.actions;

export default widgetSettingsSlice.reducer; 