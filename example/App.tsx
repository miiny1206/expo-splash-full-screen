import SplashScreen, { type SplashFailEvent } from 'expo-splash-full-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';

type LogEntry = { ts: string; line: string };

const stamp = () => new Date().toISOString().slice(11, 23);

export default function App() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const append = (line: string) => setLog((prev) => [{ ts: stamp(), line }, ...prev].slice(0, 50));

  useEffect(() => {
    append('listeners attached');
    const subs = [
      SplashScreen.addListener('didShow', () => append('didShow')),
      SplashScreen.addListener('didHide', () => append('didHide')),
      SplashScreen.addListener('didFail', (e: SplashFailEvent) => append(`didFail: ${e.reason}`)),
    ];
    // Native defers until min brand-moment elapses; calling early just lets the timeline finish naturally.
    SplashScreen.hide();
    return () => {
      for (const sub of subs) sub.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.h1}>expo-splash-full-screen</Text>
      <Text style={styles.body}>Splash auto-runs on cold start.</Text>

      <View style={styles.row}>
        <Button testID="btn-hide" title="hide" onPress={() => SplashScreen.hide()} />
        <Button
          testID="btn-hide-instant"
          title="hide instant"
          onPress={() => SplashScreen.hide({ fade: false })}
        />
        <Button
          testID="btn-show-fullscreen"
          title="full-screen"
          onPress={() => SplashScreen.showFullScreen()}
        />
      </View>

      <Text style={styles.h2}>Event log</Text>
      <ScrollView testID="event-log" style={styles.logBox}>
        {log.length === 0 ? <Text style={styles.empty}>(none yet)</Text> : null}
        {log.map((e, i) => (
          <Text key={i} testID={`log-${e.line.split(':')[0]}`} style={styles.logEntry}>
            <Text style={styles.ts}>{e.ts}</Text> {e.line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    padding: 24,
    paddingTop: 64,
  },
  h1: { color: '#fff', fontSize: 22, fontWeight: '700' },
  h2: { color: '#bbb', fontSize: 14, marginTop: 24, marginBottom: 8 },
  body: { color: '#aaa', fontSize: 14, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 24, flexWrap: 'wrap' },
  logBox: { flex: 1, backgroundColor: '#111', borderRadius: 8, padding: 12 },
  logEntry: {
    color: '#eaeaea',
    fontSize: 12,
    fontFamily: 'Courier',
    marginBottom: 4,
  },
  ts: { color: '#888' },
  empty: { color: '#555', fontStyle: 'italic' },
});
