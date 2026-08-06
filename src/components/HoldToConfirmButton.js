// HoldToConfirmButton.js — Press and hold to prevent accidental taps
import React, { useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';

export default function HoldToConfirmButton({ 
  label, 
  onConfirm, 
  theme, 
  holdDuration = 1200,
  danger = false,
  icon = null,
}) {
  const [isHolding, setIsHolding] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const confirmedRef = useRef(false);

  const startHold = useCallback(() => {
    confirmedRef.current = false;
    setIsHolding(true);
    progress.setValue(0);

    Animated.timing(progress, {
      toValue: 1,
      duration: holdDuration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !confirmedRef.current) {
        confirmedRef.current = true;
        onConfirm();
        setIsHolding(false);
        progress.setValue(0);
      }
    });
  }, [holdDuration, onConfirm]);

  const cancelHold = useCallback(() => {
    if (!confirmedRef.current) {
      progress.stopAnimation();
      Animated.timing(progress, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
      setIsHolding(false);
    }
  }, []);

  const bgColor = danger ? theme.danger : theme.primary;
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={startHold}
      onPressOut={cancelHold}
      style={[styles.container, { backgroundColor: bgColor }]}
    >
      <Animated.View style={[styles.fill, { width: progressWidth, backgroundColor: 'rgba(255,255,255,0.25)' }]} />
      <View style={styles.content}>
        <View style={styles.row}>
          {icon && (
            <Text style={{ fontSize: 18, marginRight: 8 }}>{icon}</Text>
          )}
          <Text style={styles.label}>
            {isHolding ? 'Hold to confirm...' : label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 54,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
