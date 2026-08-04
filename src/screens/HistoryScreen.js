// HistoryScreen.js — View past trips and share records
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { exportTripAsText, formatTripForHistory } from '../logic/tripManager';

export default function HistoryScreen({ history, onBack, theme }) {
  const handleShare = async (trip) => {
    try {
      const text = exportTripAsText(trip);
      await Share.share({ message: text });
    } catch (e) {
      console.error('Share failed', e);
    }
  };

  const renderItem = ({ item }) => {
    const meta = formatTripForHistory(item);
    return (
      <View style={[styles.card, { 
        backgroundColor: theme.surface, 
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }]}>
        <View style={styles.row}>
          <Text style={[styles.date, { color: theme.textSecondary }]}>
            {meta.date} · {meta.time}
          </Text>
          <View style={[styles.badge, { 
            backgroundColor: meta.status === 'ended' ? theme.successBg : theme.warningBg 
          }]}>
            <Text style={{ 
              fontSize: 11, fontWeight: '700', 
              color: meta.status === 'ended' ? theme.successText : theme.warningText 
            }}>
              {meta.status}
            </Text>
          </View>
        </View>
        <Text style={[styles.total, { color: theme.textPrimary }]}>
          Ksh {meta.total.toLocaleString()}
        </Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>
          {meta.count} passengers · {meta.checked} verified
        </Text>
        <TouchableOpacity onPress={() => handleShare(item)} style={[styles.shareBtn, { backgroundColor: theme.primary }]}>
          <Text style={styles.shareText}>Share Record</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: theme.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Trip History</Text>
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>No completed trips yet.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700' },
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  date: { fontSize: 13, fontWeight: '500' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  total: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sub: { fontSize: 14, marginTop: 2, fontWeight: '500' },
  shareBtn: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  shareText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15 },
});
