// TotalsBar.js — Green sticky bottom summary
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function TotalsBar({ totals = {}, theme }) {
  const {
    totalCollected = 0,
    checkedCount = 0,
    pendingCount = 0,
    totalPayments = 0,
    unmatchedExpected = 0
  } = totals;

  const allGood = pendingCount === 0 && unmatchedExpected === 0 && totalPayments > 0;
  const nothingYet = totalPayments === 0;

  return (
    <View style={[styles.bar, { backgroundColor: allGood ? theme.success : theme.primary }]}>
      <View style={styles.left}>
        <Text style={styles.big}>Ksh {(totalCollected || 0).toLocaleString()}</Text>
        <Text style={styles.sub}>
          {nothingYet ? 'No payments yet' : `${checkedCount} of ${totalPayments} verified`}
        </Text>
      </View>

      <View style={styles.right}>
        {unmatchedExpected > 0 && (
          <View style={[styles.pill, { backgroundColor: theme.warningBg }]}>
            <Text style={[styles.pillText, { color: theme.warningText }]}>{unmatchedExpected} waiting</Text>
          </View>
        )}
        {pendingCount > 0 && (
          <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={styles.pillTextWhite}>{pendingCount} pending</Text>
          </View>
        )}
        {allGood && totalPayments > 0 && (
          <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={styles.pillTextWhite}>All verified ✓</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  left: { flexDirection: 'column' },
  big: { fontSize: 24, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '500' },
  right: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pillText: { fontSize: 12, fontWeight: '700' },
  pillTextWhite: { fontSize: 12, fontWeight: '700', color: '#fff' },
});
