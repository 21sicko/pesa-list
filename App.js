// App.js — Ultimate Professional Ledger: Folding Layout & Math Reconciliation
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Platform, PermissionsAndroid,
  Vibration, BackHandler, NativeModules, SectionList, Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

import { useSmsListener } from './src/hooks/useSmsListener';
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
  const { theme } = useTheme();
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

  const scrollY = useRef(new Animated.Value(0)).current;

  // Remote Updates logic
  useEffect(() => {
    async function onFetchUpdateAsync() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert('Update Available', 'Install the latest business patches?',
            [{ text: 'Later' }, { text: 'Refresh', onPress: async () => { await Updates.fetchUpdateAsync(); await Updates.reloadAsync(); }}]
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
    Vibration.vibrate(message.body.includes('received') ? [0, 150, 50, 150] : [0, 80]);
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
    if (!trip || (trip.payments.length === 0 && trip.expenses.length === 0)) { showToast('No entries'); return; }
    Alert.alert("Finalize Trip?", "Save this ledger to history.",
      [{ text: "Cancel" }, { text: "End", onPress: async () => { setIsLoaded(false); await archiveTrip(trip); setTrip(createTrip()); setIsLoaded(true); showToast('Archived'); }}]
    );
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
      onSimulate={() => handleLiveSms({ body: 'SIM Confirmed. Received Ksh100 from TEST. Transaction cost, Ksh5.00', originatingAddress: 'MPESA', timestamp: Date.now() })}
      onReset={async () => { await AsyncStorage.multiRemove([ACTIVE_KEY, HISTORY_KEY]); setTrip(createTrip()); setHistory([]); setShowAdmin(false); Alert.alert('Wiped', 'Factory reset successful.'); }}
      onImport={async (data) => {
        if (data.activeTrip) await AsyncStorage.setItem(ACTIVE_KEY, serializeTrip(data.activeTrip));
        if (data.history) await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
        setTrip(data.activeTrip || createTrip());
        setHistory(data.history || []);
        setShowAdmin(false);
      }}
      theme={theme}
    />
  );

  if (!isLoaded) return <View style={[styles.container, { backgroundColor: '#0B0F0D', justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: '#fff' }}>Syncing...</Text></View>;

  const searchResults = trip ? searchPayments(trip, searchQuery) : { payments: [], expected: [] };
  const allPayments = getAllPaymentsSorted(trip);
  const filteredPayments = (searchQuery ? searchResults.payments : allPayments).filter(p => activeTab === 'IN' ? p.type === 'RECEIVED' : p.type === 'SENT');

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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Scrollable Area */}
      <Animated.SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <PaymentCard payment={item} onToggle={handleToggle} isBlurred={isPrivacyMode} isTopEarner={item.id === topEarnerId} theme={theme} />}
        renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionLabel}>{title}</Text>}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>{searchQuery ? 'No results' : 'Waiting for M-Pesa...'}</Text></View>}
        contentContainerStyle={{ paddingTop: 330, paddingBottom: 160 }}
        stickySectionHeadersEnabled={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      />

      {/* Folding Floating Header */}
      <LedgerHeader
        totals={{ ...totals, startedAt: trip?.startedAt }}
        onShowHistory={() => setShowHistory(true)}
        onManualStart={() => setTrip(createTrip())}
        onShowAdmin={() => setShowAdmin(true)}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={() => setIsPrivacyMode(!isPrivacyMode)}
        scrollY={scrollY}
      >
        <View style={styles.headerFloating}>
           <View style={styles.searchBar}>
              <Text>🔍</Text>
              <TextInput style={styles.searchInput} placeholder="Search names, phones..." value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="characters" />
           </View>
           <View style={styles.segmentedTab}>
              <TouchableOpacity onPress={() => setActiveTab('IN')} style={[styles.tab, activeTab === 'IN' && styles.tabActiveIn]}><Text style={[styles.tabText, activeTab === 'IN' && styles.tabTextActiveIn]}>INCOME</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab('OUT')} style={[styles.tab, activeTab === 'OUT' && styles.tabActiveOut]}><Text style={[styles.tabText, activeTab === 'OUT' && styles.tabTextActiveOut]}>SPENDING</Text></TouchableOpacity>
           </View>
        </View>
      </LedgerHeader>

      {flashActive && <View style={styles.flashOverlay} />}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8F7' },
  headerFloating: { paddingHorizontal: 0 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 0.5, borderColor: '#D3D1C7', backgroundColor: '#fff', elevation: 4 },
  searchInput: { flex: 1, fontSize: 13, paddingHorizontal: 8 },
  segmentedTab: { flexDirection: 'row', marginTop: 10, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 10, padding: 2 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  tabActiveIn: { backgroundColor: '#fff' },
  tabActiveOut: { backgroundColor: '#fff' },
  tabText: { fontSize: 8, fontWeight: '900', color: '#fff', letterSpacing: 1 },
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

export default function AppWrapper() { return <ErrorBoundary><App /></ErrorBoundary>; }
