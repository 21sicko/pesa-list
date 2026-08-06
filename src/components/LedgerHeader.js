// LedgerHeader.js — Green M-Pesa style header
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';

export default function LedgerHeader({ totals = {}, onShowHistory, onManualStart, onShowAdmin, theme, themeName }) {
  const { totalCollected = 0, totalPayments = 0, startedAt } = totals;
  const startTime = startedAt ? new Date(startedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '---';

  return (
    <View style={[styles.header, { backgroundColor: '#0A6E2E' }]}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          activeOpacity={1}
          onLongPress={onShowAdmin}
          delayLongPress={3000}
        >
          <Text style={styles.headerTitle}>Pesa List</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onShowHistory} style={styles.iconBtn}>
            <Text style={{ fontSize: 20 }}>📋</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onLongPress={onManualStart}
            delayLongPress={1000}
            onPress={() => {}}
            style={styles.iconBtn}>
            <Text style={{ fontSize: 20 }}>↺</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.label}>Total collected today</Text>
      <Text style={styles.totalAmt}>Ksh {(totalCollected || 0).toLocaleString()}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={{ fontSize: 14 }}>👥</Text>
          <Text style={styles.statText}>{totalPayments || 0} passengers</Text>
        </View>
        <View style={styles.stat}>
          <Text style={{ fontSize: 14 }}>🕒</Text>
          <Text style={styles.statText}>Since {startTime}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  iconBtn: {
    padding: 4,
  },
  label: {
    color: '#C0DD97',
    fontSize: 12,
    marginBottom: 4,
  },
  totalAmt: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#EAF3DE',
    fontSize: 12,
  },
});
