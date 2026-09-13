// HistoryScreen.js — View past trips and share records
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Share, Alert } from 'react-native';
import { formatTripForHistory, exportTripAsText } from '../logic/tripManager';
import { exportTripToPdf } from '../logic/pdfExporter';
import analytics from '@react-native-firebase/analytics';

export default function HistoryScreen({ history = [], onBack, theme }) {
  const handleShare = async (trip) => {
    Alert.alert(
      "Export Record",
      "Choose your preferred format",
      [
        {
          text: "Text Summary",
          onPress: async () => {
            const text = exportTripAsText(trip);
            await Share.share({ message: text });
            await analytics().logEvent('share_record_text', { trip_id: trip.id });
          }
        },
        {
          text: "PDF Statement (Pro)",
          onPress: async () => {
            try {
              await exportTripToPdf(trip);
              await analytics().logEvent('share_record_pdf', { trip_id: trip.id });
            } catch (err) {
              Alert.alert("PDF Failed", "Could not generate PDF statement.");
            }
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const renderItem = ({ item }) => {
    if (!item || !item.payments) return null;

    try {
      const meta = formatTripForHistory(item);
      return (
        <View style={[styles.ledgerRow, { borderBottomColor: '#EAF3DE' }]}>
          <View style={[styles.statusLine, { backgroundColor: meta.status === 'ended' ? '#639922' : '#FAC775' }]} />
          <View style={styles.info}>
            <Text style={styles.date}>
              {meta.date} · {meta.time}
            </Text>
            <Text style={styles.sub}>
              {meta.count} entries · Status: {meta.status}
            </Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.total}>
              Ksh {(meta.total || 0).toLocaleString()}
            </Text>
            <TouchableOpacity onPress={() => handleShare(item)} style={styles.shareBtn}>
              <Text style={styles.shareText}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    } catch (err) {
      return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: theme.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Trip History</Text>
      </View>

      {(!history || history.length === 0) ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>No completed trips yet.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item, index) => item?.id || index.toString()}
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
    paddingTop: 45,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700' },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    backgroundColor: '#fff',
  },
  statusLine: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  info: { flex: 1 },
  date: { fontSize: 14, fontWeight: '600', color: '#2C2C2A' },
  sub: { fontSize: 12, color: '#888780', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  total: { fontSize: 18, fontWeight: '700', color: '#2C2C2A' },
  shareBtn: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#EAF3DE',
  },
  shareText: { color: '#3B6D11', fontSize: 12, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15 },
});
