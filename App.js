// App.js — Pesa List: Simple, pretty, forgiving
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert, Platform, KeyboardAvoidingView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSmsListener } from './src/hooks/useSmsListener';
import { useTheme } from './src/hooks/useTheme';
import PaymentCard from './src/components/PaymentCard';
import ExpectingModal from './src/components/ExpectingModal';
import TotalsBar from './src/components/TotalsBar';
import Toast from './src/components/Toast';
import HistoryScreen from './src/screens/HistoryScreen';
import HoldToConfirmButton from './src/components/HoldToConfirmButton';

import {
  createTrip, endTrip, addPayment, addExpectedPayment,
  toggleChecked, searchPayments, getTripTotals,
  getAllPaymentsSorted, shouldAutoEnd,
  serializeTrip, deserializeTrip
} from './src/logic';

const ACTIVE_KEY = '@fv_active_trip';
const HISTORY_KEY = '@fv_history';

export default function App() {
  const { theme, themeName, toggleTheme } = useTheme();
  const [trip, setTrip] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExpecting, setShowExpecting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  // Undo toast state
  const [toast, setToast] = useState({ visible: false, message: '', paymentId: null });
  const toastTimer = useRef(null);

  // Load saved trip + history
  useEffect(() => {
    (async () => {
      try {
        const [saved, hist] = await Promise.all([
          AsyncStorage.getItem(ACTIVE_KEY),
          AsyncStorage.getItem(HISTORY_KEY)
        ]);
        if (saved) {
          const t = deserializeTrip(saved);
          if (shouldAutoEnd(t)) {
            await archiveTrip(t);
            setTrip(createTrip());
          } else {
            setTrip(t);
          }
        } else {
          setTrip(createTrip());
        }
        if (hist) setHistory(JSON.parse(hist).map(deserializeTrip));
      } catch (e) {
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

  const handleSms = useCallback((message) => {
    setTrip(currentTrip => {
      const baseTrip = currentTrip || createTrip();
      if (shouldAutoEnd(baseTrip)) {
        archiveTrip(baseTrip);
        const fresh = createTrip();
        return addPayment(fresh, message.body, message.originatingAddress).trip;
      }
      return addPayment(baseTrip, message.body, message.originatingAddress).trip;
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
    setTrip(t => {
      const updated = toggleChecked(t, paymentId);
      const payment = updated.payments.find(p => p.id === paymentId);
      const isNowChecked = payment?.checked;
      showToast(`${payment?.senderName} ${isNowChecked ? 'verified ✓' : 'un-done'}`, paymentId);
      return updated;
    });
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
    if (trip.payments.length === 0) {
      showToast('No payments to save');
      return;
    }
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

  const handleVoiceSearch = () => {
    Alert.alert('Voice Search', 'Install @react-native-voice/voice to enable. For now, type the name.', [{ text: 'OK' }]);
  };

  if (showHistory) {
    return <HistoryScreen history={history} onBack={() => setShowHistory(false)} theme={theme} />;
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

      {/* Clean Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onLongPress={handleManualStart}
            delayLongPress={1000}
            onPress={() => showToast('Hold ↺ for new trip')}
            style={styles.iconBtn}>
            <Text style={[styles.iconText, { color: theme.textSecondary }]}>↺</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Pesa List</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.iconBtn}>
              <Text style={[styles.iconText, { color: theme.textSecondary }]}>📋</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn}>
              <Text style={[styles.iconText, { color: theme.textSecondary }]}>
                {themeName === 'dark' ? '☀️' : '🌙'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchBox, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: theme.bg, color: theme.textPrimary }]}
          placeholder="Search passenger name..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="characters"
        />
        <TouchableOpacity onPress={handleVoiceSearch} style={styles.voiceBtn}>
          <Text style={{ fontSize: 20 }}>🎤</Text>
        </TouchableOpacity>
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={[styles.clearText, { color: theme.textMuted }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

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

      {/* Payment List */}
      <FlatList
        data={displayPayments}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <PaymentCard payment={item} onToggle={handleToggle} theme={theme} />}
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
              <Text style={[styles.expectedTitle, { color: theme.warningText }]}>
                Waiting for SMS ({displayExpected.length})
              </Text>
              {displayExpected.map(exp => (
                <View key={exp.id} style={[styles.expectedRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.expectedName, { color: theme.textSecondary }]}>{exp.passengerName}</Text>
                  {exp.expectedAmount && (
                    <Text style={[styles.expectedAmt, { color: theme.warning }]}>Ksh {exp.expectedAmount}</Text>
                  )}
                </View>
              ))}
            </View>
          ) : null
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 160 }}
      />

      {/* Bottom Bar */}
      <View style={[styles.bottom, { backgroundColor: theme.barBg, borderTopColor: theme.border }]}>
        <TotalsBar totals={totals} theme={theme} />
        <View style={styles.actionRow}>
          <TouchableOpacity 
            onPress={() => setShowExpecting(true)} 
            style={[styles.actionBtn, { backgroundColor: theme.primaryLight }]}>
            <Text style={[styles.actionText, { color: theme.primary }]}>➕ Expecting</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <HoldToConfirmButton
              label="End Trip"
              onConfirm={handleEndTrip}
              theme={theme}
              danger={true}
              icon="🛑"
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerRight: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8, borderRadius: 10 },
  iconText: { fontSize: 18 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 12,
    borderRadius: 12,
  },
  voiceBtn: { padding: 6 },
  clearText: { fontSize: 14, fontWeight: '600' },
  simulateBtn: {
    margin: 10,
    marginHorizontal: 16,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  simulateText: { fontSize: 13, fontWeight: '600' },
  empty: { padding: 50, alignItems: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center' },
  expectedSection: { marginTop: 16, paddingTop: 12 },
  expectedTitle: { fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  expectedRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  expectedName: { fontSize: 15 },
  expectedAmt: { fontSize: 15, fontWeight: '700' },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionText: { fontSize: 15, fontWeight: '700' },
});
