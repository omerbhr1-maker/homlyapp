import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.omerb.homly',
  appName: 'Homly',
  webDir: 'out',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
    },
  },
};

export default config;
