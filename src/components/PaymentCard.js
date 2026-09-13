import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function PaymentCard({ payment, onToggle, theme, isBlurred, isTopEarner }) {
  const isChecked = payment.checked;
  const isSent = payment.type === 'SENT';
  const isGambling = payment.isGambling;

  const dateObj = new Date(payment.receivedAt);
  const timeStr = dateObj.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  const displayName = isBlurred ? '•••••••• •••••' : payment.senderName;
  const displayPhone = isBlurred ? '••••••••••••' : (payment.senderPhone || 'Receipt');

  // Colors
  const statusColor = isSent ? '#DC2626' : (isChecked ? '#639922' : '#B4B2A9');
  const amountColor = isSent ? '#DC2626' : (isChecked ? '#3B6D11' : '#2C2C2A');

  return (
    <TouchableOpacity 
      onPress={() => !isSent && onToggle(payment.id)}
      activeOpacity={isSent ? 1 : 0.7}
      style={[styles.container, { borderBottomColor: '#EAF3DE' }]}
    >
      <View style={[styles.statusLine, { backgroundColor: statusColor }]} />

      <View style={styles.info}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text numberOfLines={1} style={[styles.name, { color: '#2C2C2A' }]}>{displayName}</Text>
          {isTopEarner && !isSent && (
            <View style={styles.topBadge}><Text style={{ fontSize: 9 }}>⭐</Text></View>
          )}
          {isGambling && (
            <View style={[styles.typeBadge, { backgroundColor: '#FEF3C7' }]}>
               <Text style={{ fontSize: 7, color: '#D97706', fontWeight: '900' }}>BETTING</Text>
            </View>
          )}
          {isSent && !isGambling && (
            <View style={[styles.typeBadge, { backgroundColor: '#FEE2E2' }]}>
               <Text style={{ fontSize: 7, color: '#DC2626', fontWeight: '900' }}>OUT</Text>
            </View>
          )}
        </View>
        <Text style={[styles.meta, { color: '#888780' }]}>
          {displayPhone} · {timeStr}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {isSent ? '-' : (isChecked ? '+' : '')}Ksh {(payment.amount || 0).toLocaleString()}
        </Text>
        <Text style={{ fontSize: 8, color: '#B4B2A9', fontWeight: '600' }}>
          {isSent ? 'EXPENDITURE' : (isChecked ? 'VERIFIED' : 'PENDING')}
        </Text>
      </View>

      {!isSent && (
        <View style={styles.iconBox}>
          <Text style={{ fontSize: 18 }}>{isChecked ? "✅" : "○"}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, backgroundColor: '#fff' },
  statusLine: { width: 3, height: 32, borderRadius: 2, marginRight: 12 },
  info: { flex: 1, paddingRight: 8 },
  name: { fontSize: 14, fontWeight: '700' },
  topBadge: { backgroundColor: '#FFF8E1', padding: 1, borderRadius: 4, marginLeft: 6, borderWidth: 0.5, borderColor: '#FFD54F' },
  typeBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginLeft: 6 },
  meta: { fontSize: 10, marginTop: 1 },
  amount: { fontSize: 14, fontWeight: '800' },
  iconBox: { width: 24, alignItems: 'center', marginLeft: 8 },
});
