// App.js — Pesa List: Hardened & Professionally Digitized
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert, Platform, KeyboardAvoidingView, PermissionsAndroid,
  AppRegistry, AppState, Vibration, BackHandler, NativeModules
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

import {
  createTrip, endTrip,  addPayment, addExpectedPayment, addExpense,
  toggleChecked, searchPayments, getTripTotals,
  getAllPaymentsSorted, shouldAutoEnd,
  serializeTrip, deserializeTrip
} from './src/logic';

const ACTIVE_KEY = '@fv_active_trip';
const HISTORY_KEY = '@fv_history';

// BACKGROUND SMS HANDLER (Headless JS)
const SmsBackgroundEvent = async (data) => {
  try {
    const { body, sender } = data;
    // We try to process it, but the NATIVE side now also caches it in SharedPreferences
    // as a fail-safe. This Headless JS part is for real-time UI updates if the app is
    // backgrounded but JS engine is alive.
    const saved = await AsyncStorage.getItem(ACTIVE_KEY);
    if (!saved) return;

    let trip = deserializeTrip(saved);
    const result = addPayment(trip, body, sender);
    if (result.added) {
      await AsyncStorage.setItem(ACTIVE_KEY, serializeTrip(result.trip));
    }
  } catch (e) {}
};

AppRegistry.registerHeadlessTask('SmsBackgroundEvent', () => SmsBackgroundEvent);

function App() {
  const { theme, themeName, toggleTheme } = useTheme();
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

  // Undo toast state
  const [toast, setToast] = useState({ visible: false, message: '', paymentId: null });
  const toastTimer = useRef(null);

  // NATIVE MISSED MESSAGE SWEEP
  const checkMissed = useCallback(async () => {
    const { SmsBridge } = NativeModules;
    if (!SmsBridge) return;

    try {
      const json = await SmsBridge.drainStoredMessages();
      const missed = JSON.parse(json);
      if (missed && missed.length > 0) {
        setTrip(currentTrip => {
          if (!currentTrip) return currentTrip;
          let updated = currentTrip;
          missed.forEach(msg => {
            const result = addPayment(updated, msg.body, msg.originatingAddress);
            updated = result.trip;
          });
          return { ...updated };
        });
      }
    } catch (e) {}
  }, []);

  // Handle Back Button
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

  // Refresh data on foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        await checkMissed();
      }
    });
    return () => subscription.remove();
  }, [checkMissed]);

  // Battery Optimization Check
  useEffect(() => {
    if (Platform.OS === 'android') {
      requestBackgroundReliability().then(isIgnoring => {
        if (!isIgnoring) {
          Alert.alert(
            "Keep Pesa List Alive",
            "To record payments while your screen is off, please disable battery optimization for Pesa List.",
            [
              { text: "Later", style: "cancel" },
              { text: "Fix Now", onPress: () => requestBackgroundReliability() }
            ]
          );
        }
      });
    }
  }, []);

  // INITIAL LOAD
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
            PermissionsAndroid.PERMISSIONS.READ_SMS,
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          ]);
          const { SmsForegroundModule } = NativeModules;
          if (SmsForegroundModule) await SmsForegroundModule.startService();
        }

        const [saved, hist] = await Promise.all([
          AsyncStorage.getItem(ACTIVE_KEY),
          AsyncStorage.getItem(HISTORY_KEY)
        ]);

        let initialTrip = saved ? deserializeTrip(saved) : createTrip();
        if (shouldAutoEnd(initialTrip)) {
          await archiveTrip(initialTrip);
          initialTrip = createTrip();
        }
        setTrip(initialTrip);

        if (hist) setHistory(JSON.parse(hist).map(deserializeTrip));
        setIsLoaded(true);
      } catch (e) {
        setTrip(createTrip());
        setIsLoaded(true);
      }
    })();
  }, []);

  // SAFE AUTO-SAVE (Prevents state erasure)
  useEffect(() => {
    if (isLoaded && trip && trip.id) {
      AsyncStorage.setItem(ACTIVE_KEY, serializeTrip(trip)).catch(() => {});
    }
  }, [trip, isLoaded]);

  const archiveTrip = async (t) => {
    const ended = endTrip(t);
    try {
      const hist = await AsyncStorage.getItem(HISTORY_KEY);
      const arr = hist ? JSON.parse(hist) : [];
      arr.unshift(serializeTrip(ended));
      if (arr.length > 50) arr.pop();
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
      setHistory(arr.map(deserializeTrip));
    } catch (e) {}
    await AsyncStorage.removeItem(ACTIVE_KEY);
  };

  const handleSms = useCallback(async (message) => {
    // Update SMS Debug Log for Admin
    setSmsLog(prev => [{
      time: message.timestamp || Date.now(),
      body: message.body
    }, ...prev].slice(0, 15));

    Vibration.vibrate([0, 200, 100, 200]);
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 800);

    setTrip(currentTrip => {
      if (!currentTrip) return currentTrip;
      const result = addPayment(currentTrip, message.body, message.originatingAddress);
      return result.trip;
    });
  }, []);

  useSmsListener(handleSms);

  const handleEndTrip = async () => {
    if (!trip || (trip.payments.length === 0 && trip.expenses.length === 0)) {
      showToast('No data to save');
      return;
    }

    Alert.alert(
      "Confirm End Trip",
      "This will save your current ledger to history and start a fresh one.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Trip",
          onPress: async () => {
            setIsLoaded(false); // Gate saves
            await archiveTrip(trip);
            setTrip(createTrip());
            setIsLoaded(true);
            showToast('Trip archived');
          }
        }
      ]
    );
  };

  const handleManualStart = async () => {
    const hasData = trip?.payments.length > 0 || trip?.expenses.length > 0;
    if (hasData) {
      Alert.alert(
        "Save Current Trip?",
        "Should we save your current data to history first?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => setTrip(createTrip()) },
          { text: "Save & Start", onPress: async () => { await archiveTrip(trip); setTrip(createTrip()); } }
        ]
      );
    } else {
      setTrip(createTrip());
    }
  };

  const handleToggle = (paymentId) => {
    setTrip(t => {
      if (!t) return t;
      return toggleChecked(t, paymentId);
    });
  };

  const handleExpecting = (name, amount) => {
    setTrip(t => {
      const result = addExpectedPayment(t || createTrip(), name, amount);
      return result.trip;
    });
  };

  const handleExpense = (category, amount) => {
    setTrip(t => {
      return addExpense(t || createTrip(), category, amount);
    });
  };

  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  if (showHistory) return <HistoryScreen history={history} onBack={() => setShowHistory(false)} theme={theme} />;

  if (showAdmin) return (
    <AdminScreen
      history={history}
      smsLog={smsLog}
      onBack={() => setShowAdmin(false)}
      onSync={checkMissed}
      onSimulate={() => handleSms({ body: `SIM Confirmed. Received Ksh100 from TEST`, sender: 'MPESA' })}
      theme={theme}
    />
  );

  if (!isLoaded) return (
    <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: theme.textSecondary }}>Synchronizing Ledger...</Text>
    </View>
  );

  const allSorted = trip ? getAllPaymentsSorted(trip) : [];
  const searchResults = trip ? searchPayments(trip, searchQuery) : { payments: [], expected: [] };
  const isSearching = searchQuery.trim().length > 0;
  const displayPayments = isSearching ? searchResults.payments : allSorted;
  const totals = trip ? getTripTotals(trip) : {};

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LedgerHeader
        totals={{ ...totals, startedAt: trip?.startedAt }}
        onShowHistory={() => setShowHistory(true)}
        onManualStart={handleManualStart}
        onShowAdmin={() => setShowAdmin(true)}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={() => setIsPrivacyMode(!isPrivacyMode)}
        theme={theme}
      />
      {flashActive && <View style={styles.flashOverlay} />}

      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: '#fff', borderColor: '#D3D1C7' }]}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search last 4 digits or name..."
            placeholderTextColor="#888780"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <FlatList
        data={displayPayments}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PaymentCard payment={item} onToggle={handleToggle} theme={theme} isBlurred={isPrivacyMode} />
        )}
        ListHeaderComponent={<Text style={styles.sectionLabel}>ACTIVITY</Text>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              {isSearching ? 'No matches' : 'No payments detected yet.\nEnsure background service is running.'}
            </Text>
            {!isSearching && (
               <TouchableOpacity onPress={handleManualStart} style={styles.startBtn}>
                  <Text style={styles.startBtnText}>↺ Reset Trip</Text>
               </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={{ paddingBottom: 160 }}
      />

      <View style={[styles.bottom, { backgroundColor: '#fff', borderTopColor: '#EAF3DE' }]}>
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={() => setShowExpecting(true)} style={styles.actionIconBtn}>
            <Text style={{ fontSize: 18 }}>➕</Text>
            <Text style={styles.actionIconText}>Expect</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowExpenseModal(true)} style={styles.actionIconBtn}>
            <Text style={{ fontSize: 18 }}>⛽</Text>
            <Text style={styles.actionIconText}>Cost</Text>
          </TouchableOpacity>
          <View style={{ flex: 1.5 }}>
            <HoldToConfirmButton label="End Trip" onConfirm={handleEndTrip} theme={theme} icon="🏁" />
          </View>
        </View>
      </View>

      <Toast visible={toast.visible} message={toast.message} theme={theme} />
      <ExpectingModal visible={showExpecting} onClose={() => setShowExpecting(false)} onSubmit={handleExpecting} theme={theme} />
      <ExpenseModal visible={showExpenseModal} onClose={() => setShowExpenseModal(false)} onSubmit={handleExpense} theme={theme} />
    </View>
  );
}

export default function AppWrapper() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: { paddingHorizontal: 16, marginTop: -14, zIndex: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 0.5, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  searchInput: { flex: 1, fontSize: 13, paddingHorizontal: 8 },
  sectionLabel: { color: '#5F5E5A', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 20, marginTop: 16, marginBottom: 8 },
  empty: { padding: 50, alignItems: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  startBtn: { marginTop: 20, backgroundColor: '#0A6E2E', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  flashOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0E9F6E', opacity: 0.3, zIndex: 9999 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 20, borderTopWidth: 0.5, elevation: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionIconBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#EAF3DE', backgroundColor: '#fff' },
  actionIconText: { fontSize: 11, fontWeight: '600', color: '#5B6560', marginTop: 2 },
});
