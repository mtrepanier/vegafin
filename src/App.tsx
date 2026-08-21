import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@amazon-devices/react-navigation__native';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import {
  ServerRepositoryProvider,
  useCurrentUser,
  useServerRepositoryReady,
} from './services/storage/ServerRepositoryContext';
import { RootNavigator } from './navigation/RootNavigator';
import { SetupNavigator } from './navigation/SetupNavigator';

// Mirrors MainActivity.kt: boot the session, then route to either the pre-auth setup flow
// or the main app depending on whether a session was restored.
function Root() {
  const { colors, dark } = useTheme();
  const ready = useServerRepositoryReady();
  const currentUser = useCurrentUser();

  if (!ready) {
    const loadingStyle = [styles.loading, { backgroundColor: colors.background }];
    return (
      <View style={loadingStyle}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.onBackground,
          border: colors.border,
          notification: colors.error,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      {currentUser ? <RootNavigator /> : <SetupNavigator />}
    </NavigationContainer>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ServerRepositoryProvider>
        <Root />
      </ServerRepositoryProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
