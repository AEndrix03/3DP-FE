import { definePreset } from '@primeng/themes';
import Lara from '@primeng/themes/lara';

const Preset = definePreset(Lara, {
  semantic: {
    primary: {
      50: '#e6f2ff',
      100: '#cce5ff',
      200: '#99ccff',
      300: '#66b3ff',
      400: '#3399ff',
      500: '#007fff',
      600: '#0066cc',
      700: '#004c99',
      800: '#003366',
      900: '#001933',
      950: '#000d1a',
    },
    surface: {
      0: '#ffffff',
      50: '#f4f7fa',
      100: '#eaeff5',
      200: '#d3dce6',
      dark: {
        0: '#0d1117',
        50: '#161b22',
        100: '#21262d',
        200: '#30363d',
      },
    },
    text: {
      0: '#3b3b3b',
      50: '#4b4b4b',
      100: '#6b7280',
      dark: {
        0: '#c9d1d9',
        50: '#8b949e',
      },
    },
  },
});

export default Preset;
