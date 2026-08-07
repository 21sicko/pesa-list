// App.js — Pesa List: Simple, pretty, forgiving
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert, Platform, KeyboardAvoidingView, PermissionsAndroid,
  AppRegistry, AppState
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSmsListener } from './src/hooks/useSmsListener';
import { useTheme } from './src/hooks/useTheme';
import PaymentCard from './src/components/PaymentCard';
import ExpectingModal from './src/components/ExpectingModal';
import LedgerHeader from './src/components/LedgerHeader';
import Toast from './src/components/Toast';
import HistoryScreen from './src/screens/HistoryScreen';
import HoldToConfirmButton from './src/components/HoldToConfirmButton';
import AdminScreen from './src/screens/AdminScreen';
import ErrorBoundary from './src/ErrorBoundary';
// import { Ionicons } from '@expo/vector-icons';
// import analytics from '@react-native-firebase/analytics'; // Requires native setup

import {
  createTrip, endTrip, addPayment, addExpectedPayment,
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
    const saved = await AsyncStorage.getItem(ACTIVE_KEY);
    let trip = saved ? deserializeTrip(saved) : createTrip();

    if (shouldAutoEnd(trip)) {
      // For background, we don't archive to history easily without complex logic,
      // so we just start a new trip if needed.
      trip = createTrip();
    }

    const result = addPayment(trip, body, sender);
    if (result.added) {
      await AsyncStorage.setItem(ACTIVE_KEY, serializeTrip(result.trip));
    }
  } catch (e) {
    console.error('Background SMS processing failed', e);
  }
};

AppRegistry.registerHeadlessTask('SmsBackgroundEvent', () => SmsBackgroundEvent);

function App() {
  const { theme, themeName, toggleTheme } = useTheme();
  const [trip, setTrip] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExpecting, setShowExpecting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [history, setHistory] = useState([]);
  const [smsLog, setSmsLog] = useState([]);

  // Undo toast state
  const [toast, setToast] = useState({ visible: false, message: '', paymentId: null });
  const toastTimer = useRef(null);

  // Refresh data when app comes back to foreground
  useEffect(() => {
    const checkMissed = async () => {
      const missed = await getMissedSms();
      if (missed && missed.length > 0) {
        setTrip(currentTrip => {
          let updated = currentTrip || createTrip();
          missed.forEach(msg => {
            const result = addPayment(updated, msg.body, msg.sender);
            updated = result.trip;
          });
          return updated;
        });
      }
    };

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        try {
          const saved = await AsyncStorage.getItem(ACTIVE_KEY);
          if (saved) setTrip(deserializeTrip(saved));
          await checkMissed();
        } catch (e) {}
      }
    });

    checkMissed(); // Also check on initial load
    return () => subscription.remove();
  }, []);

  // Load saved trip + history
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
        }

        // Firebase Analytics: Log App Open
        // try { await analytics().logAppOpen(); } catch(e) {}

        const [saved, hist] = await Promise.all([
          AsyncStorage.getItem(ACTIVE_KEY),
          AsyncStorage.getItem(HISTORY_KEY)
        ]);

        let initialTrip = createTrip();
        if (saved) {
          const t = deserializeTrip(saved);
          if (shouldAutoEnd(t)) {
            await archiveTrip(t);
          } else {
            initialTrip = t;
          }
        }
        setTrip(initialTrip);

        if (hist) setHistory(JSON.parse(hist).map(deserializeTrip));
      } catch (e) {
        console.error('Init failed', e);
        setTrip(createTrip());
      }
    })();
  }, []);

  useEffect(() => {
    if (trip) AsyncStorage.setItem(ACTIVE_KEY, serializeTrip(trip)).catch(() => {});
  }, [trip]);

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
    // Log raw SMS for admin debug
    setSmsLog(prev => [{ time: Date.now(), body: message.body }, ...prev].slice(0, 10));

    // We use a functional update to avoid stale closure issues with 'trip'
    // but we must be careful NOT to do side effects inside the updater.
    // However, for SMS we usually want the latest trip.

    setTrip(currentTrip => {
      const baseTrip = currentTrip || createTrip();

      // If the trip should have ended, we just start a new one for this SMS.
      // The auto-archiving of the old one is handled in the background if possible,
      // but here we just ensure the user gets their payment recorded.
      let targetTrip = baseTrip;
      if (shouldAutoEnd(baseTrip)) {
        targetTrip = createTrip();
      }

      const result = addPayment(targetTrip, message.body, message.originatingAddress);
      return result.trip;
    });
  }, []);

  useSmsListener(handleSms);

  const showToast = (message, paymentId = null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message, paymentId });
    toastTimer.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  // Handle check/uncheck with undo toast
  const handleToggle = (paymentId) => {
    let paymentName = '';
    let isNowChecked = false;

    setTrip(t => {
      if (!t) return t;
      const updated = toggleChecked(t, paymentId);
      const payment = updated.payments.find(p => p.id === paymentId);
      paymentName = payment?.senderName || 'Payment';
      isNowChecked = !!payment?.checked;
      return updated;
    });

    // Side effect OUTSIDE the updater
    showToast(`${paymentName} ${isNowChecked ? 'verified ✓' : 'un-done'}`, paymentId);
  };

  const handleUndo = () => {
    if (toast.paymentId) {
      handleToggle(toast.paymentId); // Toggle back
      setToast(prev => ({ ...prev, visible: false }));
      if (toastTimer.current) clearTimeout(toastTimer.current);
    }
  };

  const handleExpecting = (name, amount) => {
    setTrip(t => {
      const result = addExpectedPayment(t || createTrip(), name, amount);
      return result.trip;
    });
  };

  const handleEndTrip = async () => {
    if (!trip || trip.payments.length === 0) {
      showToast('No payments to save');
      return;
    }

    // Firebase Analytics: Log Trip End
    /*
    try {
      await analytics().logEvent('trip_ended', {
        total_ksh: getTripTotals(trip).totalCollected,
        passengers: trip.payments.length
      });
    } catch(e) {}
    */

    await archiveTrip(trip);
    setTrip(createTrip());
    setSearchQuery('');
    showToast('Trip saved to history');
  };

  const handleManualStart = async () => {
    if (trip?.payments.length > 0) {
      await archiveTrip(trip);
    }
    setTrip(createTrip());
    setSearchQuery('');
    showToast('New trip started');
  };

  const handleFactoryReset = async () => {
    await AsyncStorage.multiRemove([ACTIVE_KEY, HISTORY_KEY, '@pesalist_theme']);
    setTrip(createTrip());
    setHistory([]);
    setShowAdmin(false);
    showToast('All data cleared');
  };

  const handleImportData = async (data) => {
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(data.history || []));
      if (data.activeTrip) {
        await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(data.activeTrip));
        setTrip(deserializeTrip(JSON.stringify(data.activeTrip)));
      }
      setHistory((data.history || []).map(deserializeTrip));
      setShowAdmin(false);
      showToast('Data imported successfully');
    } catch (e) {
      Alert.alert('Import Failed', e.message);
    }
  };

  if (showHistory) {
    return <HistoryScreen history={history} onBack={() => setShowHistory(false)} theme={theme} />;
  }

  if (showAdmin) {
    return (
      <AdminScreen
        history={history}
        smsLog={smsLog}
        onBack={() => setShowAdmin(false)}
        onReset={handleFactoryReset}
        onImport={handleImportData}
        onSimulate={() => handleSms({
          body: `SIM_${Date.now()} Confirmed. You have received Ksh${Math.floor(Math.random()*500)+50} from ADMIN TEST On 1/8/26 New M-PESA balance is Ksh5000.`,
          originatingAddress: 'MPESA',
        })}
        theme={theme}
      />
    );
  }

  const allSorted = trip ? getAllPaymentsSorted(trip) : [];
  const searchResults = trip ? searchPayments(trip, searchQuery) : { payments: [], expected: [] };
  const isSearching = searchQuery.trim().length > 0;
  const displayPayments = isSearching ? searchResults.payments : allSorted;
  const displayExpected = isSearching ? searchResults.expected : (trip ? trip.expected.filter(e => !e.matched) : []);
  const totals = trip ? getTripTotals(trip) : {};

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={themeName === 'dark' ? 'light-content' : 'dark-content'} />

      <LedgerHeader
        totals={{ ...totals, startedAt: trip?.startedAt }}
        onShowHistory={() => setShowHistory(true)}
        onManualStart={handleManualStart}
        onShowAdmin={() => setShowAdmin(true)}
        theme={theme}
        themeName={themeName}
      />

      {/* Search Bar - Floating */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: '#fff', borderColor: '#D3D1C7' }]}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search passenger..."
            placeholderTextColor="#888780"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.micBtn}>
            <Text style={{ fontSize: 16 }}>🎤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Payment List */}
      <FlatList
        data={displayPayments}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <PaymentCard payment={item} onToggle={handleToggle} theme={theme} />}
        ListHeaderComponent={
          <Text style={styles.sectionLabel}>TODAY</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              {isSearching ? 'No matches found' : 'No payments yet. Tap "Simulate M-Pesa SMS" to test.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          displayExpected.length > 0 ? (
            <View style={styles.expectedSection}>
              {displayExpected.map(exp => (
                <View key={exp.id} style={styles.expectedRow}>
                  <View style={[styles.statusLine, { backgroundColor: '#FAC775' }]} />
                  <View style={styles.info}>
                    <Text style={styles.expectedName}>Awaiting SMS ({exp.passengerName})</Text>
                    <Text style={styles.expectedMeta}>Expected passenger</Text>
                  </View>
                  <Text style={styles.expectedAmt}>Ksh {exp.expectedAmount || 0}</Text>
                  <Text style={{ fontSize: 18 }}>⏳</Text>
                </View>
              ))}
            </View>
          ) : null
        }
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 160 }}
      />

      {/* Debug simulate */}
      {Platform.OS === 'android' && __DEV__ && (
        <TouchableOpacity
          onPress={() => handleSms({
            body: 'S98GE969 Confirmed. You have received Ksh50 from TEST USER 254700000000 On 1/8/26 at 11:33 AM New M-PESA balance is Ksh500.',
            originatingAddress: 'MPESA',
          })}
          style={[styles.simulateBtn, { backgroundColor: theme.surfaceHover }]}>
          <Text style={[styles.simulateText, { color: theme.textSecondary }]}>🧪 Simulate M-Pesa SMS</Text>
        </TouchableOpacity>
      )}

      {/* Bottom Bar */}
      <View style={[styles.bottom, { backgroundColor: '#fff', borderTopColor: '#EAF3DE' }]}>
        <View style={styles.actionRow}>
          <TouchableOpacity 
            onPress={() => setShowExpecting(true)} 
            style={styles.expectingBtn}>
            <Text style={{ fontSize: 16 }}>➕</Text>
            <Text style={styles.expectingText}>Expecting</Text>
          </TouchableOpacity>
          <View style={{ flex: 1.4 }}>
            <HoldToConfirmButton
              label="End Trip"
              onConfirm={handleEndTrip}
              theme={{ ...theme, danger: '#0A6E2E' }}
              danger={false}
              icon="🏁"
            />
          </View>
        </View>
      </View>

      {/* Undo Toast */}
      <Toast 
        visible={toast.visible} 
        message={toast.message} 
        actionLabel="Undo" 
        onAction={handleUndo}
        theme={theme}
      />

      <ExpectingModal
        visible={showExpecting}
        onClose={() => setShowExpecting(false)}
        onSubmit={handleExpecting}
        theme={theme}
      />
    </SafeAreaView>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: -14,
    zIndex: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 0.5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingHorizontal: 8,
  },
  micBtn: { padding: 4 },
  list: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 10,
  },
  sectionLabel: {
    color: '#5F5E5A',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  simulateBtn: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    padding: 10,
    borderRadius: 10,
    zIndex: 5,
  },
  simulateText: { fontSize: 13, fontWeight: '600' },
  empty: { padding: 50, alignItems: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center' },
  expectedSection: { paddingVertical: 8 },
  expectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statusLine: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: 12,
  },
  info: { flex: 1 },
  expectedName: { color: '#2C2C2A', fontSize: 14, fontWeight: '500' },
  expectedMeta: { color: '#888780', fontSize: 11, marginTop: 2 },
  expectedAmt: { color: '#854F0B', fontSize: 15, fontWeight: '600', marginRight: 10 },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
    borderTopWidth: 0.5,
    elevation: 10,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  expectingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#639922',
    backgroundColor: '#fff',
  },
  expectingText: { fontSize: 13, fontWeight: '600', color: '#3B6D11' },
});
