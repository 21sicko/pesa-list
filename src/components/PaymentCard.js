// PaymentCard.js — Ledger row style
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';

export default function PaymentCard({ payment, onToggle, theme, isBlurred }) {
  const isChecked = payment.checked;
  const time = payment.receivedAt
    ? new Date(payment.receivedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
    : '';

  const displayName = isBlurred ? '•••••••• •••••' : payment.senderName;
  const displayPhone = isBlurred ? '••••••••••••' : (payment.senderPhone || 'No Phone');

  return (
    <TouchableOpacity 
      onPress={() => onToggle(payment.id)}
      activeOpacity={0.7}
      style={[styles.container, { borderBottomColor: '#EAF3DE' }]}
    >
      <View style={[styles.statusLine, { backgroundColor: isChecked ? '#639922' : '#B4B2A9' }]} />

      <View style={styles.info}>
        <Text style={[styles.name, { color: '#2C2C2A' }]}>{displayName}</Text>
        <Text style={[styles.meta, { color: '#888780' }]}>
          {displayPhone} · {time}
        </Text>
      </View>

      <Text style={[styles.amount, { color: isChecked ? '#3B6D11' : '#2C2C2A' }]}>
        {isChecked ? '+' : ''}Ksh {(payment.amount || 0).toLocaleString()}
      </Text>

      <View style={styles.iconBox}>
        <Text style={{ fontSize: 18 }}>
          {isChecked ? "✅" : "○"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    backgroundColor: '#fff',
  },
  statusLine: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    fontSize: 11,
    marginTop: 2,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  iconBox: {
    width: 24,
    alignItems: 'center',
  },
});
