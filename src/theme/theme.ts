'use client';

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0b0d10', paper: '#12161b' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body': { minHeight: '100%' },
        body: { margin: 0 },
      },
    },
  },
});
