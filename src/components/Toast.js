// Toast.js — Simple bottom toast for undo feedback
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

export default function Toast({ message, actionLabel, onAction, theme, visible }) {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor: theme.textPrimary }]}>
      <Text style={[styles.message, { color: theme.surface }]} numberOfLines={1}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} style={styles.actionBtn}>
          <Text style={[styles.actionText, { color: theme.primary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  message: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 12 },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  actionText: { fontSize: 14, fontWeight: '700' },
});
