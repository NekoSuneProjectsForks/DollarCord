// DollarCord mobile client (Expo / React Native).
// Connects to any DollarCord server (cloud or self-hosted) and runs its web UI in a
// WebView with mic/camera permissions for voice & video. The server URL is saved
// between launches; long-press the header (pull-to-switch) to change it.

import React, { useEffect, useState, useCallback } from "react";
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar,
} from "react-native";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "dollarcord.serverUrl";

export default function App() {
  const [serverUrl, setServerUrl] = useState(null);
  const [input, setInput] = useState("http://localhost:3000");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v) setServerUrl(v);
      setLoading(false);
    });
  }, []);

  const connect = useCallback(async () => {
    let url = input.trim().replace(/\/$/, "");
    if (!/^https?:\/\//.test(url)) url = "https://" + url;
    await AsyncStorage.setItem(KEY, url);
    setServerUrl(url);
  }, [input]);

  const disconnect = useCallback(async () => {
    await AsyncStorage.removeItem(KEY);
    setServerUrl(null);
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: "#1e1f22" }]}>
        <ActivityIndicator color="#7c6af7" />
      </View>
    );
  }

  if (serverUrl) {
    return (
      <SafeAreaView style={styles.flex}>
        <StatusBar barStyle="light-content" />
        <View style={styles.bar}>
          <Text style={styles.barText} numberOfLines={1}>{serverUrl.replace(/^https?:\/\//, "")}</Text>
          <TouchableOpacity onPress={disconnect}><Text style={styles.switch}>Switch</Text></TouchableOpacity>
        </View>
        <WebView
          source={{ uri: serverUrl }}
          style={styles.flex}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          // Grant mic/camera to the loaded site automatically.
          onPermissionRequest={(e) => e.nativeEvent?.grant?.(e.nativeEvent.resources)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, styles.center, { padding: 24 }]}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.logo}>💸 DollarCord</Text>
      <Text style={styles.sub}>Connect to your server</Text>
      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="https://chat.example.com"
        placeholderTextColor="#80848e"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.input}
      />
      <TouchableOpacity style={styles.button} onPress={connect}>
        <Text style={styles.buttonText}>Connect</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Self-hosting? Run your own node from the `selfhost` branch.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#1e1f22" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { color: "#fff", fontSize: 28, fontWeight: "700", marginBottom: 4 },
  sub: { color: "#b5bac1", fontSize: 14, marginBottom: 24 },
  input: {
    width: "100%", backgroundColor: "#2b2d31", color: "#e3e5e8", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
  },
  button: { width: "100%", backgroundColor: "#7c6af7", borderRadius: 8, paddingVertical: 14, marginTop: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hint: { color: "#80848e", fontSize: 12, marginTop: 18, textAlign: "center" },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#111214" },
  barText: { color: "#b5bac1", fontSize: 12, flex: 1 },
  switch: { color: "#7c6af7", fontSize: 13, fontWeight: "600", marginLeft: 12 },
});
