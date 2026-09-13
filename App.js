// App.js — Professional Business & Debt Management Suite
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert, Platform, KeyboardAvoidingView, PermissionsAndroid,
  AppRegistry, AppState, Vibration, BackHandler, NativeModules, SectionList
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

import { useSmsListener, requestBackgroundReliability } from './src/hooks/useSmsListener';
import { useTheme } from './src/hooks/useTheme';
import PaymentCard from './src/components/PaymentCard';
import ExpectingModal from './src/components/ExpectingModal';
import ExpenseModal from './src/components/ExpenseModal';
import LedgerHeader from './src/components/LedgerHeader';
import Toast from './src/components/Toast';
import HistoryScreen from './src/screens/HistoryScreen';
import HoldToConfirmButton from './src/components/HoldToConfirmButton';
import AdminScreen from './src/screens/AdminScreen';
import ErrorBoundary from './src/ErrorBoundary';
import analytics from '@react-native-firebase/analytics';

import {
  createTrip, endTrip,  addPayment, addExpectedPayment, addExpense,
  toggleChecked, searchPayments, getTripTotals,
  getAllPaymentsSorted, shouldAutoEnd,
  serializeTrip, deserializeTrip
} from './src/logic';

const ACTIVE_KEY = '@fv_active_trip';
const HISTORY_KEY = '@fv_history';

function App() {
  const { theme, themeName } = useTheme();
  const [trip, setTrip] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExpecting, setShowExpecting] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [smsLog, setSmsLog] = useState([]);
  const [flashActive, setFlashActive] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [activeTab, setActiveTab] = useState('IN');

  // OTA Update Check
  useEffect(() => {
    async function onFetchUpdateAsync() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert('Update Available', 'A new version of Pesa List is available. Update now?',
            [{ text: 'Later' }, { text: 'Update', onPress: async () => { await Updates.fetchUpdateAsync(); await Updates.reloadAsync(); }}]
          );
        }
      } catch (e) {}
    }
    if (!__DEV__) onFetchUpdateAsync();
  }, []);

  const processAndSetTrip = useCallback((msg, currentTrip) => {
    if (!currentTrip) return null;
    const result = addPayment(currentTrip, msg.body, msg.originatingAddress, msg.timestamp);
    if (result.added) {
        if (result.payment.type === 'SENT' && activeTab === 'IN') setActiveTab('OUT');
        if (result.payment.type === 'RECEIVED' && activeTab === 'OUT') setActiveTab('IN');
    }
    return result;
  }, [activeTab]);

  const handleLiveSms = useCallback(async (message) => {
    Vibration.vibrate(message.body.includes('Ksh 1,000') ? [0, 200, 100, 200] : [0, 100]);
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 800);
    setTrip(currentTrip => {
      const result = processAndSetTrip(message, currentTrip || createTrip());
      return result ? result.trip : currentTrip;
    });
  }, [processAndSetTrip]);

  const { syncManual } = useSmsListener(handleLiveSms);

  const handleHistoricalSync = useCallback(async (messages) => {
    setTrip(currentTrip => {
      let updated = currentTrip || createTrip();
      const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
      sorted.forEach(msg => {
        const result = addPayment(updated, msg.body, msg.originatingAddress, msg.timestamp);
        updated = result.trip;
      });
      return { ...updated };
    });
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (showAdmin) { setShowAdmin(false); return true; }
      if (showHistory) { setShowHistory(false); return true; }
      if (showExpecting) { setShowExpecting(false); return true; }
      if (showExpenseModal) { setShowExpenseModal(false); return true; }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showAdmin, showHistory, showExpecting, showExpenseModal]);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
            PermissionsAndroid.PERMISSIONS.READ_SMS,
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          ]);
        }
        try { await analytics().logAppOpen(); } catch(e) {}
        const [saved, hist] = await Promise.all([ AsyncStorage.getItem(ACTIVE_KEY), AsyncStorage.getItem(HISTORY_KEY) ]);
        let initialTrip = saved ? deserializeTrip(saved) : createTrip();
        if (shouldAutoEnd(initialTrip)) { await archiveTrip(initialTrip); initialTrip = createTrip(); }
        setTrip(initialTrip);
        if (hist) setHistory(JSON.parse(hist).map(h => typeof h === 'string' ? deserializeTrip(h) : h));
        setTimeout(syncManual, 1000);
        setIsLoaded(true);
      } catch (e) { setTrip(createTrip()); setIsLoaded(true); }
    })();
  }, [syncManual]);

  useEffect(() => {
    if (isLoaded && trip) AsyncStorage.setItem(ACTIVE_KEY, serializeTrip(trip)).catch(() => {});
  }, [trip, isLoaded]);

  const archiveTrip = async (t) => {
    const ended = endTrip(t);
    try {
      const hist = await AsyncStorage.getItem(HISTORY_KEY);
      const arr = hist ? JSON.parse(hist) : [];
      const cleanArr = arr.map(item => typeof item === 'string' ? JSON.parse(item) : item);
      cleanArr.unshift(ended);
      if (cleanArr.length > 50) cleanArr.pop();
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(cleanArr));
      setHistory(cleanArr);
    } catch (e) {}
    await AsyncStorage.removeItem(ACTIVE_KEY);
  };

  const handleEndTrip = async () => {
    if (!trip || (trip.payments.length === 0 && trip.expenses.length === 0)) { showToast('No data to save'); return; }
    try {
      const totals = getTripTotals(trip);
      await analytics().logEvent('trip_ended', { total_ksh: totals.totalCollected, sent_ksh: totals.totalSent, passengers: trip.payments.length });
    } catch(e) {}
    Alert.alert("End Trip?", "Save current data to history.",
      [{ text: "Cancel" }, { text: "End", onPress: async () => { setIsLoaded(false); await archiveTrip(trip); setTrip(createTrip()); setIsLoaded(true); showToast('Trip archived'); }}]
    );
  };

  const handleManualStart = async () => {
    const hasData = (trip?.payments.length > 0 || trip?.expenses.length > 0);
    if (hasData) {
      Alert.alert("New Trip?", "Save current data first?",
        [{ text: "Discard", style: 'destructive', onPress: () => setTrip(createTrip()) },
         { text: "Save", onPress: async () => { await archiveTrip(trip); setTrip(createTrip()); }}]
      );
    } else { setTrip(createTrip()); }
  };

  const handleToggle = (id) => setTrip(t => toggleChecked(t, id));
  const handleExpecting = (n, a) => setTrip(t => addExpectedPayment(t, n, a).trip);
  const handleExpense = (c, a) => setTrip(t => addExpense(t, c, a));
  const showToast = (m) => { setToast({ visible: true, message: m }); setTimeout(() => setToast({ visible: false, message: '' }), 3000); };

  if (showHistory) return <HistoryScreen history={history} onBack={() => setShowHistory(false)} theme={theme} />;
  if (showAdmin) return (
    <AdminScreen
      history={history}
      smsLog={smsLog}
      onBack={() => setShowAdmin(false)}
      onSync={syncManual}
      onSyncHistorical={handleHistoricalSync}
      onSimulate={() => handleLiveSms({ body: 'Confirmed. Received Ksh100 from TEST', originatingAddress: 'MPESA', timestamp: Date.now() })}
      onReset={async () => { await AsyncStorage.multiRemove([ACTIVE_KEY, HISTORY_KEY]); setTrip(createTrip()); setHistory([]); setShowAdmin(false); Alert.alert('Reset Success', 'All data cleared.'); }}
      onImport={async (data) => {
        if (data.activeTrip) await AsyncStorage.setItem(ACTIVE_KEY, serializeTrip(data.activeTrip));
        if (data.history) await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
        setTrip(data.activeTrip || createTrip());
        setHistory(data.history || []);
        setShowAdmin(false);
        Alert.alert('Import Success', 'Data restored.');
      }}
      onUpdateFulizaLimit={(limit) => setTrip(t => ({ ...t, fulizaLimit: limit }))}
      currentFulizaLimit={trip?.fulizaLimit || 0}
      theme={theme}
    />
  );

  if (!isLoaded) return <View style={[styles.container, { backgroundColor: '#0B0F0D', justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: '#fff', fontSize: 16 }}>Readying Ledger...</Text></View>;

  const searchResults = trip ? searchPayments(trip, searchQuery) : { payments: [], expected: [] };
  const allPayments = getAllPaymentsSorted(trip);
  const filteredPayments = (searchQuery ? searchResults.payments : allPayments).filter(p => activeTab === 'IN' ? p.type === 'RECEIVED' : p.type === 'SENT');

  // Group by Date for Neatness
  const sections = [];
  const groups = filteredPayments.reduce((acc, p) => {
    const d = new Date(p.receivedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    if (!acc[d]) acc[d] = [];
    acc[d].push(p);
    return acc;
  }, {});
  Object.keys(groups).forEach(date => sections.push({ title: date, data: groups[date] }));

  const totals = getTripTotals(trip);
  const topEarnerId = trip?.payments.filter(p => p.type === 'RECEIVED').sort((a,b) => b.amount - a.amount)[0]?.id;

  return (
    <View style={[styles.container, { backgroundColor: '#F6F8F7' }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LedgerHeader
        totals={{ ...totals, startedAt: trip?.startedAt }}
        onShowHistory={() => setShowHistory(true)}
        onManualStart={handleManualStart}
        onShowAdmin={() => setShowAdmin(true)}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={() => setIsPrivacyMode(!isPrivacyMode)}
      />
      {flashActive && <View style={styles.flashOverlay} />}

      <View style={styles.viewContainer}>
        <View style={styles.searchBar}>
          <Text>🔍</Text>
          <TextInput style={styles.searchInput} placeholder="Search ledger..." value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="characters" />
        </View>
        <View style={styles.segmentedTab}>
          <TouchableOpacity onPress={() => setActiveTab('IN')} style={[styles.tab, activeTab === 'IN' && styles.tabActiveIn]}><Text style={[styles.tabText, activeTab === 'IN' && styles.tabTextActiveIn]}>IN</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('OUT')} style={[styles.tab, activeTab === 'OUT' && styles.tabActiveOut]}><Text style={[styles.tabText, activeTab === 'OUT' && styles.tabTextActiveOut]}>OUT</Text></TouchableOpacity>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <PaymentCard payment={item} onToggle={handleToggle} isBlurred={isPrivacyMode} isTopEarner={item.id === topEarnerId} theme={theme} />}
        renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionLabel}>{title}</Text>}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>{searchQuery ? 'No matches' : 'No entries yet.'}</Text></View>}
        contentContainerStyle={{ paddingBottom: 160 }}
        stickySectionHeadersEnabled={false}
      />

      <View style={styles.bottom}>
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={() => setShowExpecting(true)} style={styles.actionIconBtn}><Text>➕</Text><Text style={styles.actionIconText}>Expect</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setShowExpenseModal(true)} style={styles.actionIconBtn}><Text>⛽</Text><Text style={styles.actionIconText}>Cost</Text></TouchableOpacity>
          <View style={{ flex: 1.5 }}><HoldToConfirmButton label="End Trip" onConfirm={handleEndTrip} icon="🏁" theme={theme} /></View>
        </View>
      </View>

      <Toast visible={toast.visible} message={toast.message} theme={theme} />
      <ExpectingModal visible={showExpecting} onClose={() => setShowExpecting(false)} onSubmit={handleExpecting} theme={theme} />
      <ExpenseModal visible={showExpenseModal} onClose={() => setShowExpenseModal(false)} onSubmit={handleExpense} theme={theme} />
    </View>
  );
}

export default function AppWrapper() { return <ErrorBoundary><App /></ErrorBoundary>; }

const styles = StyleSheet.create({
  container: { flex: 1 },
  viewContainer: { paddingHorizontal: 16, marginTop: -14, zIndex: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 0.5, borderColor: '#D3D1C7', backgroundColor: '#fff', elevation: 4 },
  searchInput: { flex: 1, fontSize: 13, paddingHorizontal: 8 },
  segmentedTab: { flexDirection: 'row', marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 2, borderWidth: 1, borderColor: '#EAF3DE' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  tabActiveIn: { backgroundColor: '#F0F9EB' },
  tabActiveOut: { backgroundColor: '#FEF2F2' },
  tabText: { fontSize: 9, fontWeight: '900', color: '#888780', letterSpacing: 1 },
  tabTextActiveIn: { color: '#0A6E2E' },
  tabTextActiveOut: { color: '#DC2626' },
  sectionLabel: { color: '#5F5E5A', fontSize: 10, fontWeight: '800', paddingHorizontal: 20, marginTop: 15, marginBottom: 4, letterSpacing: 1 },
  empty: { padding: 50, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#888780' },
  flashOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0E9F6E', opacity: 0.2, zIndex: 9999 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 20, borderTopWidth: 0.5, borderColor: '#EAF3DE', backgroundColor: '#fff' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionIconBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#EAF3DE' },
  actionIconText: { fontSize: 10, fontWeight: '600', color: '#5B6560' },
});
