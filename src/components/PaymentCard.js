// PaymentCard.js — Phone completely hidden, tap to reveal
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function PaymentCard({ payment, onToggle, theme }) {
  const isChecked = payment.checked;
  const [showPhone, setShowPhone] = useState(false);

  return (
    <TouchableOpacity 
      onPress={() => onToggle(payment.id)}
      activeOpacity={0.85}
      style={[styles.card, { 
        backgroundColor: isChecked ? theme.successBg : theme.warningBg,
        borderColor: isChecked ? theme.success : theme.warning,
        shadowColor: theme.shadow,
      }]}
    >
      <View style={[styles.accent, { backgroundColor: isChecked ? theme.success : theme.warning }]} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: isChecked ? theme.successText : theme.textPrimary }]} numberOfLines={1}>
            {isChecked ? '✓ ' : '○ '}{payment.senderName}
          </Text>
          <Text style={[styles.amount, { color: isChecked ? theme.successText : theme.textPrimary }]}>
            Ksh {payment.amount?.toLocaleString()}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {isChecked ? 'Verified — tap to undo' : 'Tap to verify'}
          </Text>

          {payment.senderPhone && (
            <TouchableOpacity 
              onPress={(e) => { e.stopPropagation(); setShowPhone(!showPhone); }}
              style={[styles.phoneBox, { backgroundColor: theme.primaryLight }]}
            >
              <Text style={[styles.phoneText, { color: theme.textSecondary }]}>
                {showPhone ? payment.senderPhone : '🔒 Phone hidden'}
              </Text>
              <Text style={[styles.phoneHint, { color: theme.primary }]}>
                {showPhone ? '  hide' : '  tap to show'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  accent: {
    width: 5,
  },
  content: {
    flex: 1,
    padding: 16,
    paddingLeft: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  amount: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  phoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  phoneHint: {
    fontSize: 11,
    fontWeight: '700',
  },
});
