import { StyleSheet, Text, View } from 'react-native';

export function RootErrorFallback() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something broke on the way in.</Text>
      <Text style={styles.body}>Your data is safe on this device. Close and reopen the app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
  },
  title: {
    color: '#f5f5f5',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    color: '#c9c9c9',
    fontSize: 14,
    textAlign: 'center',
  },
});
