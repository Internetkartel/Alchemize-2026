import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { TouchableOpacity } from '@/components/HapticTouchable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { Wrench, Send, CheckCircle2, Loader2 } from 'lucide-react-native';
import { z } from 'zod';
import { createRorkTool, useRorkAgent } from '@rork-ai/toolkit-sdk';
import {
  getAppDiagnostics,
  clearCorruptedAuthCache,
  resetHealthKitConnection,
  resyncSubscription,
} from '@/lib/diagnostics';

const SYSTEM_PROMPT = `You are the in-app diagnostics assistant for Alchemize, a personal wellness app (habits, fitness, nutrition, finances, journaling).
A user is describing something broken. Ask at most one clarifying question if truly needed, otherwise go straight to diagnosing.
Use get_app_diagnostics first to see real app state before guessing. Only call a repair tool when it's actually likely to fix what the user described:
- clear_corrupted_auth_cache: sign-in stuck, "can't log in", app crashes on launch right after login/signup.
- reset_healthkit_connection: Apple Health sync stuck, permission stuck in a bad state, "HealthKit says denied but I allowed it".
- resync_subscription: "I paid but it still shows free", Pro features locked after a real purchase.
None of these tools can fix bugs in the app's code itself — they only repair corrupted local state and re-sync with external services (HealthKit, RevenueCat). If the problem is a real code bug (wrong calculation, crash unrelated to the above, UI glitch), say so plainly and tell the user to report it — do not pretend to fix it.
Keep replies short (2-4 sentences), plain language, no markdown.`;

const getDiagnosticsTool = createRorkTool({
  description: "Read-only snapshot of the app's current state: feature flags, HealthKit status, subscription status, and any corrupted local storage. Always call this before diagnosing.",
  zodSchema: z.object({}),
  execute: async () => JSON.stringify(await getAppDiagnostics()),
});

const clearAuthCacheTool = createRorkTool({
  description: 'Clears local auth-related storage keys ONLY if they fail to parse as valid data. Fixes "stuck on login" or "crashes right after sign in" caused by corrupted local state. Forces the user to sign in again.',
  zodSchema: z.object({}),
  execute: async () => JSON.stringify(await clearCorruptedAuthCache()),
});

const resetHealthKitTool = createRorkTool({
  description: 'Clears the locally cached Apple Health connection state so the user can reconnect cleanly. Use when HealthKit sync or permissions seem stuck. Does not change anything in iOS Settings.',
  zodSchema: z.object({}),
  execute: async () => JSON.stringify(await resetHealthKitConnection()),
});

const resyncSubscriptionTool = createRorkTool({
  description: 'Re-pulls purchase/subscription state from the app store and RevenueCat. Use when a user paid but Pro features are still locked.',
  zodSchema: z.object({}),
  execute: async () => JSON.stringify(await resyncSubscription()),
});

const TOOLS = {
  get_app_diagnostics: getDiagnosticsTool,
  clear_corrupted_auth_cache: clearAuthCacheTool,
  reset_healthkit_connection: resetHealthKitTool,
  resync_subscription: resyncSubscriptionTool,
};

export default function BugFixerScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const { messages, sendMessage, status, setMessages } = useRorkAgent({ tools: TOOLS });

  useEffect(() => {
    setMessages([
      {
        id: 'system-0',
        role: 'system',
        parts: [{ type: 'text', text: SYSTEM_PROMPT }],
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBusy = status === 'submitted' || status === 'streaming';

  const handleSend = () => {
    const text = input.trim();
    if (!text || isBusy) return;
    sendMessage({ text });
    setInput('');
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const visibleMessages = messages.filter(m => m.role !== 'system');

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Bug Fixer',
          headerStyle: { backgroundColor: '#0f0a1f' },
          headerTintColor: '#fff',
        }}
      />
      <LinearGradient colors={['#0f0a1f', '#1a0a3e', '#0c0520']} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.messages, { paddingBottom: insets.bottom + 16 }]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {visibleMessages.length === 0 && (
            <View style={styles.emptyState}>
              <Wrench color="#a78bfa" size={32} />
              <Text style={styles.emptyTitle}>Describe what&apos;s broken</Text>
              <Text style={styles.emptySubtitle}>
                I can check app state and fix common issues: stuck sign-in, Apple Health not syncing, or a
                purchase not unlocking Pro. For anything else, I&apos;ll tell you it needs a real fix from the dev team.
              </Text>
            </View>
          )}

          {visibleMessages.map(message => (
            <View
              key={message.id}
              style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}
            >
              {message.parts.map((part, i) => {
                if (part.type === 'text') {
                  return (
                    <Text key={i} style={message.role === 'user' ? styles.userText : styles.assistantText}>
                      {part.text}
                    </Text>
                  );
                }
                if (part.type === 'tool') {
                  const label = part.toolName.replace(/_/g, ' ');
                  return (
                    <View key={i} style={styles.toolRow}>
                      {part.state === 'output-available' ? (
                        <CheckCircle2 color="#22c55e" size={14} />
                      ) : (
                        <Loader2 color="#a78bfa" size={14} />
                      )}
                      <Text style={styles.toolText}>
                        {part.state === 'output-available' ? `Ran: ${label}` : `Running: ${label}...`}
                      </Text>
                    </View>
                  );
                }
                return null;
              })}
            </View>
          ))}

          {isBusy && (
            <View style={[styles.bubble, styles.assistantBubble]}>
              <ActivityIndicator color="#a78bfa" size="small" />
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="What's not working?"
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
            editable={!isBusy}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isBusy) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || isBusy}
          >
            <Send color="#fff" size={18} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0520' },
  flex: { flex: 1 },
  messages: { padding: 16, gap: 10, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 10 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '700' as const },
  emptySubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  bubble: { maxWidth: '85%', borderRadius: 16, padding: 12, gap: 6 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#7c3aed' },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)' },
  userText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  assistantText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontStyle: 'italic' as const },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
});
