// AdminScreen.js — Professional Business Monitoring
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Share, TextInput, KeyboardAvoidingView, Platform, NativeModules
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLifetimeStats } from '../logic/tripManager';
import analytics from '@react-native-firebase/analytics';

export default function AdminScreen({
  history, smsLog, onBack, onReset, onImport, onSync, onSyncHistorical, onSimulate, theme
}) {
  const stats = getLifetimeStats(history);
  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scanDays, setScanDays] = useState('30');

  const handleSync = async () => {
    setIsSyncing(true);
    await onSync();
    setIsSyncing(false);
    Alert.alert('Sync Complete', 'Background cache processed.');
  };

  const handleHistoricalScan = async () => {
    const { SmsBridge } = NativeModules;
    if (!SmsBridge) return;
    const days = parseInt(scanDays) || 30;
    if (days > 366) { Alert.alert('Limit Exceeded', 'Maximum range is 366 days.'); return; }
    setIsSyncing(true);
    try {
      const now = Date.now();
      const from = now - (days * 24 * 60 * 60 * 1000);
      const json = await SmsBridge.readInboxRange(from, now);
      const messages = JSON.parse(json);
      if (onSyncHistorical) await onSyncHistorical(messages);
      Alert.alert('Scan Complete', `Processed ${messages.length} messages.`);
    } catch (e) {
      Alert.alert('Scan Failed', e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleShareApp = async () => {
    try {
      await Share.share({ message: 'Hey! I use Pesa List to track my M-Pesa business ledger automatically. Download it to manage your money better!', url: 'https://pesalist.app' });
      await analytics().logEvent('share_app', { method: 'admin_panel' });
    } catch (e) {}
  };

  const handleExportCSV = async () => {
    try {
      let csv = 'Date,Time,Type,Sender,Phone,Amount,Fee,Status\n';
      history.forEach(trip => {
        trip.payments.forEach(p => {
          const date = new Date(p.receivedAt).toLocaleDateString();
          const time = new Date(p.receivedAt).toLocaleTimeString();
          csv += `"${date}","${time}","${p.type}","${p.senderName}","${p.senderPhone || ''}",${p.amount},${p.txCost},"${p.checked ? 'Verified' : 'Pending'}"\n`;
        });
      });
      await Share.share({ message: csv, title: 'Pesa List Export' });
    } catch (e) {}
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={[styles.header, { backgroundColor: '#0A6E2E' }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Text style={{ color: '#fff', fontSize: 24 }}>←</Text></TouchableOpacity>
        <Text style={styles.title}>Business Dashboard</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LIFETIME METRICS</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Income</Text>
              <Text style={styles.statVal}>Ksh {stats.totalCollected.toLocaleString()}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Spent</Text>
              <Text style={[styles.statVal, { color: '#DC2626' }]}>Ksh {stats.totalSent?.toLocaleString() || 0}</Text>
            </View>
            <View style={[styles.statBox, { borderColor: '#FFB2B2' }]}>
              <Text style={[styles.statLabel, { color: '#DC2626' }]}>Total Fees</Text>
              <Text style={[styles.statVal, { color: '#DC2626' }]}>Ksh {stats.totalFees?.toLocaleString() || 0}</Text>
            </View>
            <View style={[styles.statBox, { borderColor: '#FBBF24' }]}>
              <Text style={[styles.statLabel, { color: '#FBBF24' }]}>Betting Waste</Text>
              <Text style={[styles.statVal, { color: '#F59E0B' }]}>Ksh {stats.totalGamblingWasted?.toLocaleString() || 0}</Text>
            </View>
            <View style={[styles.statBox, { borderColor: '#60A5FA' }]}>
              <Text style={[styles.statLabel, { color: '#60A5FA' }]}>Airtime Spent</Text>
              <Text style={[styles.statVal, { color: '#3B82F6' }]}>Ksh {stats.totalUtilitySpent?.toLocaleString() || 0}</Text>
            </View>
            <View style={[styles.statBox, { borderColor: '#C084FC' }]}>
              <Text style={[styles.statLabel, { color: '#A855F7' }]}>Phone Loans</Text>
              <Text style={[styles.statVal, { color: '#9333EA' }]}>Ksh {stats.totalPhoneLoanSpent?.toLocaleString() || 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1-YEAR HISTORICAL SCAN</Text>
          <View style={styles.syncBox}>
            <Text style={styles.syncLabel}>Scan inbox for last X days:</Text>
            <View style={styles.row}>
              <TextInput style={styles.daysInput} keyboardType="number-pad" value={scanDays} onChangeText={setScanDays} />
              <TouchableOpacity onPress={handleHistoricalScan} disabled={isSyncing} style={[styles.scanBtn, isSyncing && { opacity: 0.5 }]}>
                <Text style={styles.scanBtnText}>{isSyncing ? 'Scanning...' : 'Start Scan'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Full 366-day recovery supported.</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATA MANAGEMENT</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity onPress={onSimulate} style={styles.actionBtn}><Text>🧪 Test Sim</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleSync} style={styles.actionBtn}><Text>🔄 Sync Cache</Text></TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleExportCSV} style={[styles.actionBtn, { marginTop: 12 }]}><Text>📊 Export CSV (Excel)</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleShareApp} style={[styles.actionBtn, { marginTop: 12, backgroundColor: '#E3F5EC' }]}><Text style={{ color: '#0A6E2E', fontWeight: '700' }}>📲 Share App</Text></TouchableOpacity>
          <TouchableOpacity onPress={onReset} style={styles.resetBtn}><Text style={styles.resetText}>🗑️ Factory Reset</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8F7' },
  header: { paddingTop: 45, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  scroll: { padding: 20 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#888780', letterSpacing: 1, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statBox: { flex: 1, minWidth: '45%', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#EAF3DE' },
  statLabel: { fontSize: 10, color: '#888780', marginBottom: 4, fontWeight: '800' },
  statVal: { fontSize: 15, fontWeight: '700', color: '#0A6E2E' },
  syncBox: { backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#EAF3DE' },
  syncLabel: { fontSize: 12, color: '#2C2C2A', fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  daysInput: { flex: 1, borderWidth: 1, borderColor: '#D3D1C7', borderRadius: 10, paddingHorizontal: 12, fontSize: 16, height: 45 },
  scanBtn: { flex: 1.5, backgroundColor: '#0A6E2E', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  hint: { fontSize: 9, color: '#888780', marginTop: 10, fontStyle: 'italic' },
  btnRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, backgroundColor: '#EAF3DE', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resetBtn: { padding: 16, marginTop: 20, borderRadius: 12, borderWidth: 1, borderColor: '#FCE4E4', alignItems: 'center' },
  resetText: { color: '#DC2626', fontWeight: '700' },
});
