import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';

export default function LedgerHeader({
  totals = {}, onShowHistory, onManualStart, onShowAdmin,
  isPrivacyMode, onTogglePrivacy, theme, themeName
}) {
  const {
    totalCollected = 0,
    totalPayments = 0,
    startedAt,
    totalExpenses = 0,
    netProfit = 0
  } = totals;

  const startTime = startedAt ? new Date(startedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '---';

  const DAILY_TARGET = 5000;
  const progress = Math.min(totalCollected / DAILY_TARGET, 1);
  const successRatio = totalCollected > 0 ? ((netProfit / totalCollected) * 100).toFixed(0) : 0;
  const hasData = totalPayments > 0 || totalExpenses > 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerInner}>
        {/* Top Navigation Row */}
        <View style={styles.headerTop}>
          <TouchableOpacity
            activeOpacity={1}
            onLongPress={onShowAdmin}
            delayLongPress={3000}
          >
            <Text style={styles.headerTitle}>PESA<Text style={{ fontWeight: '300', opacity: 0.7 }}>LIST</Text></Text>
          </TouchableOpacity>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={onTogglePrivacy} style={[styles.glassBtn, isPrivacyMode && styles.activeGlass]}>
              <Text style={{ fontSize: 16 }}>{isPrivacyMode ? '👁️' : '🕶️'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onShowHistory} style={styles.glassBtn}>
              <Text style={{ fontSize: 18 }}>📋</Text>
            </TouchableOpacity>
            <TouchableOpacity onLongPress={onManualStart} delayLongPress={1000} style={styles.glassBtn}>
              <Text style={{ fontSize: 18 }}>↺</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Stats Area */}
        <View style={styles.displayArea}>
          <View>
            <View style={[styles.statusBadge, { backgroundColor: hasData ? 'rgba(0,255,0,0.1)' : 'rgba(255,255,255,0.1)' }]}>
              <View style={[styles.liveDot, { backgroundColor: hasData ? '#00FF00' : '#888' }]} />
              <Text style={styles.statusText}>{hasData ? 'TRIP IN PROGRESS' : 'READY FOR TRIP'}</Text>
            </View>
            <Text style={styles.mainAmount}>
              <Text style={styles.currency}>Ksh</Text> {isPrivacyMode ? '••••' : netProfit.toLocaleString()}
            </Text>
            <Text style={styles.labelCaps}>NET PROFIT TODAY</Text>
          </View>

          <View style={styles.circleDisplay}>
             <Text style={styles.ratioText}>{successRatio}%</Text>
             <Text style={styles.ratioLabel}>EFFICIENCY</Text>
          </View>
        </View>

        {/* Modern Metrics Bar */}
        <View style={styles.metricsBar}>
          <View style={styles.metric}>
            <Text style={styles.mLabel}>COLLECTED</Text>
            <Text style={styles.mVal}>{totalCollected.toLocaleString()}</Text>
          </View>
          <View style={styles.mDivider} />
          <View style={styles.metric}>
            <Text style={styles.mLabel}>EXPENSES</Text>
            <Text style={[styles.mVal, { color: '#FF9E9E' }]}>{totalExpenses.toLocaleString()}</Text>
          </View>
          <View style={styles.mDivider} />
          <View style={styles.metric}>
            <Text style={styles.mLabel}>TRIPS</Text>
            <Text style={styles.mVal}>{totalPayments}</Text>
          </View>
        </View>

        {/* Pro Progress Track */}
        <View style={styles.trackContainer}>
           <View style={styles.trackBg}>
              <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
           </View>
           <View style={styles.trackLabels}>
              <Text style={styles.trackSub}>Since {startTime}</Text>
              <Text style={styles.trackSub}>Daily Goal: {DAILY_TARGET}</Text>
           </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A6E2E',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingTop: StatusBar.currentHeight + 10, // Dynamic padding for status bar
    paddingBottom: 28,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  headerInner: { paddingHorizontal: 22 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  headerRight: { flexDirection: 'row', gap: 12 },
  glassBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  activeGlass: { backgroundColor: 'rgba(255,255,255,0.3)', borderColor: '#fff' },
  displayArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FF00', marginRight: 6 },
  statusText: { color: '#C0DD97', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  mainAmount: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  currency: { fontSize: 18, color: '#C0DD97', fontWeight: '400' },
  labelCaps: { color: '#C0DD97', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginTop: 2 },
  circleDisplay: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
    borderTopColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  ratioText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  ratioLabel: { color: '#C0DD97', fontSize: 7, fontWeight: '700' },
  metricsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metric: { flex: 1, alignItems: 'center' },
  mDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
  mLabel: { color: '#C0DD97', fontSize: 8, fontWeight: '800', marginBottom: 4 },
  mVal: { color: '#fff', fontSize: 16, fontWeight: '700' },
  trackContainer: { marginTop: 25 },
  trackBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  trackSub: { color: '#EAF3DE', fontSize: 10, fontWeight: '600', opacity: 0.7 },
});
