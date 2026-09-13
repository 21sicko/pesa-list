import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';

export default function LedgerHeader({
  totals = {}, onShowHistory, onManualStart, onShowAdmin,
  isPrivacyMode, onTogglePrivacy
}) {
  const {
    totalCollected = 0,
    totalSent = 0,
    totalPayments = 0,
    startedAt,
    totalExpenses = 0,
    netProfit = 0,
    currentFulizaDebt = 0,
    kcbLoan = 0,
    mshwariLoan = 0,
    totalLoanDebt = 0,
    latestMpesaBalance = 0,
    reconciledBalance = 0,
    gamblingWasted = 0
  } = totals;

  const startTime = startedAt ? new Date(startedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '---';

  const DAILY_TARGET = 5000;
  const progress = Math.min(totalCollected / DAILY_TARGET, 1);
  const successRatio = totalCollected > 0 ? ((netProfit / totalCollected) * 100).toFixed(0) : 0;
  const hasData = totalPayments > 0 || totalExpenses > 0 || totalSent > 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerInner}>
        {/* Top Row */}
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>PESA<Text style={{ fontWeight: '300', opacity: 0.7 }}>LIST</Text></Text>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={onShowAdmin} style={styles.glassBtn}>
              <Text style={{ fontSize: 16 }}>📊</Text>
            </TouchableOpacity>
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

        {/* Main Amount Area */}
        <View style={styles.displayArea}>
          <View>
            <View style={[styles.statusBadge, { backgroundColor: hasData ? 'rgba(0,255,0,0.1)' : 'rgba(255,255,255,0.1)' }]}>
              <View style={[styles.liveDot, { backgroundColor: hasData ? '#00FF00' : '#888' }]} />
              <Text style={styles.statusText}>{hasData ? 'LIVE LEDGER' : 'READY'}</Text>
            </View>
            <Text style={styles.mainAmount}>
              <Text style={styles.currency}>Ksh</Text> {isPrivacyMode ? '••••' : reconciledBalance.toLocaleString()}
            </Text>
            <Text style={styles.labelCaps}>NET FINANCIAL POSITION (CASH - DEBTS)</Text>
          </View>

          <View style={styles.circleDisplay}>
             <Text style={styles.ratioText}>{successRatio}%</Text>
             <Text style={styles.ratioLabel}>PROFIT</Text>
          </View>
        </View>

        {/* Gambling Warning */}
        {gamblingWasted > 0 && (
          <View style={styles.gamblingBanner}>
             <Text style={styles.bannerLabel}>BETTING WASTE:</Text>
             <Text style={styles.bannerValue}>-Ksh {gamblingWasted.toLocaleString()}</Text>
          </View>
        )}

        {/* Detailed Debt & Balance Banner */}
        <View style={styles.balanceBanner}>
           <View style={{ flex: 1.2 }}>
              <Text style={styles.balanceLabel}>M-PESA CASH:</Text>
              <Text style={styles.balanceValue}>Ksh {latestMpesaBalance.toLocaleString()}</Text>
           </View>

           <View style={styles.verticalDivider} />

           <View style={{ flex: 2, paddingLeft: 10 }}>
              <Text style={[styles.balanceLabel, { color: totalLoanDebt > 0 ? '#FFB2B2' : '#C0DD97' }]}>
                TOTAL LOANS: Ksh {totalLoanDebt.toLocaleString()}
              </Text>
              <View style={styles.loanRow}>
                 {currentFulizaDebt > 0 && <Text style={styles.loanTiny}>Fuliza: {currentFulizaDebt.toLocaleString()}</Text>}
                 {kcbLoan > 0 && <Text style={styles.loanTiny}>KCB: {kcbLoan.toLocaleString()}</Text>}
                 {mshwariLoan > 0 && <Text style={styles.loanTiny}>M-Shwari: {mshwariLoan.toLocaleString()}</Text>}
                 {totalLoanDebt === 0 && <Text style={styles.loanTiny}>All clear! ✓</Text>}
              </View>
           </View>
        </View>

        {/* Metrics Bar */}
        <View style={styles.metricsBar}>
          <View style={styles.metric}>
            <Text style={styles.mLabel}>RECEIVED</Text>
            <Text style={styles.mVal}>{totalCollected.toLocaleString()}</Text>
          </View>
          <View style={styles.mDivider} />
          <View style={styles.metric}>
            <Text style={styles.mLabel}>SENT</Text>
            <Text style={[styles.mVal, { color: '#FF9E9E' }]}>{totalSent.toLocaleString()}</Text>
          </View>
          <View style={styles.mDivider} />
          <View style={styles.metric}>
            <Text style={styles.mLabel}>COSTS</Text>
            <Text style={[styles.mVal, { color: '#FFB2B2' }]}>{totalExpenses.toLocaleString()}</Text>
          </View>
        </View>

        {/* Progress Track */}
        <View style={styles.trackContainer}>
           <View style={styles.trackBg}>
              <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
           </View>
           <View style={styles.trackLabels}>
              <Text style={styles.trackSub}>Started: {startTime}</Text>
              <Text style={styles.trackSub}>Daily Goal: {DAILY_TARGET}</Text>
           </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0A6E2E', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingTop: StatusBar.currentHeight + 10, paddingBottom: 28, elevation: 20 },
  headerInner: { paddingHorizontal: 22 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 1.5 },
  headerRight: { flexDirection: 'row', gap: 8 },
  glassBtn: { backgroundColor: 'rgba(255,255,255,0.12)', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  activeGlass: { backgroundColor: 'rgba(255,255,255,0.3)', borderColor: '#fff' },
  displayArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { color: '#C0DD97', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  mainAmount: { color: '#fff', fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  currency: { fontSize: 16, color: '#C0DD97', fontWeight: '400' },
  labelCaps: { color: '#C0DD97', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  circleDisplay: { width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
  ratioText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  ratioLabel: { color: '#C0DD97', fontSize: 6, fontWeight: '800' },
  gamblingBanner: { backgroundColor: 'rgba(251, 191, 36, 0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.3)' },
  bannerLabel: { color: '#FBBF24', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  bannerValue: { color: '#fff', fontSize: 10, fontWeight: '700' },
  balanceBanner: { backgroundColor: 'rgba(0, 0, 0, 0.25)', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  verticalDivider: { width: 1, height: 24, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  balanceLabel: { color: '#C0DD97', fontSize: 8, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  balanceValue: { color: '#fff', fontSize: 12, fontWeight: '700' },
  loanRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  loanTiny: { color: '#FFB2B2', fontSize: 8, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  metricsBar: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  metric: { flex: 1, alignItems: 'center' },
  mDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  mLabel: { color: '#C0DD97', fontSize: 8, fontWeight: '800', marginBottom: 2 },
  mVal: { color: '#fff', fontSize: 14, fontWeight: '700' },
  trackContainer: { marginTop: 20 },
  trackBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  trackSub: { color: '#EAF3DE', fontSize: 9, fontWeight: '600', opacity: 0.7 },
});
