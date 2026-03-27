import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.omerb.homly',
  appName: 'Homly',
  webDir: 'out',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 10000,
      launchFadeOutDuration: 300,
      backgroundColor: '#14b8a6',
    },
  },
};

export default config;
