// AdminScreen.js — System monitoring and data management
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Share, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { Ionicons } from '@expo/vector-icons';
import { getLifetimeStats } from '../logic/tripManager';

export default function AdminScreen({ history, smsLog, onBack, onReset, onImport, theme }) {
  const stats = getLifetimeStats(history);
  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);

  const handleExport = async () => {
    try {
      const active = await AsyncStorage.getItem('@fv_active_trip');
      const hist = await AsyncStorage.getItem('@fv_history');
      const data = {
        exportDate: new Date().toISOString(),
        activeTrip: active ? JSON.parse(active) : null,
        history: hist ? JSON.parse(hist) : []
      };
      await Share.share({
        message: JSON.stringify(data, null, 2),
        title: 'Pesa List Data Export'
      });
    } catch (e) {
      Alert.alert('Export Failed', e.message);
    }
  };

  const handleImportSubmit = () => {
    try {
      const data = JSON.parse(importJson);
      if (!data.history) throw new Error('Invalid backup format');

      Alert.alert(
        'Confirm Import',
        'This will replace ALL current data. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Replace',
            style: 'destructive',
            onPress: () => onImport(data)
          }
        ]
      );
    } catch (e) {
      Alert.alert('Import Failed', 'Please paste valid Pesa List JSON data.');
    }
  };

  const handleFactoryReset = () => {
    Alert.alert(
      'Factory Reset',
      'This will delete EVERYTHING (trips, history, settings). This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'RESET ALL',
          style: 'destructive',
          onPress: onReset
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: '#F6F8F7' }]}
    >
      <View style={[styles.header, { backgroundColor: '#0A6E2E' }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={{ color: '#fff', fontSize: 24 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Admin Panel</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Lifetime Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LIFETIME PERFORMANCE</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Collected</Text>
              <Text style={styles.statVal}>Ksh {stats.totalCollected.toLocaleString()}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Trips Done</Text>
              <Text style={styles.statVal}>{stats.totalTrips}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Avg / Trip</Text>
              <Text style={styles.statVal}>
                Ksh {stats.totalTrips > 0 ? Math.round(stats.totalCollected / stats.totalTrips).toLocaleString() : 0}
              </Text>
            </View>
          </View>
        </View>

        {/* SMS Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECENT SMS LOG (DEBUG)</Text>
          <View style={styles.logContainer}>
            {smsLog.length === 0 ? (
              <Text style={styles.emptyLog}>No messages captured in this session.</Text>
            ) : (
              smsLog.map((log, i) => (
                <View key={i} style={styles.logItem}>
                  <Text style={styles.logTime}>{new Date(log.time).toLocaleTimeString()}</Text>
                  <Text style={styles.logBody}>{log.body}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATA MANAGEMENT</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity onPress={handleExport} style={[styles.actionBtn, { backgroundColor: '#EAF3DE' }]}>
              <Text style={{ fontSize: 18 }}>📥</Text>
              <Text style={[styles.btnText, { color: '#3B6D11' }]}>Export Backup</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowImport(!showImport)} style={[styles.actionBtn, { backgroundColor: '#EAF3DE' }]}>
              <Text style={{ fontSize: 18 }}>📤</Text>
              <Text style={[styles.btnText, { color: '#3B6D11' }]}>Import Data</Text>
            </TouchableOpacity>
          </View>

          {showImport && (
            <View style={styles.importBox}>
              <TextInput
                multiline
                style={styles.importInput}
                placeholder="Paste JSON here..."
                value={importJson}
                onChangeText={setImportJson}
              />
              <TouchableOpacity onPress={handleImportSubmit} style={styles.submitImport}>
                <Text style={styles.submitImportText}>Confirm Import</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={handleFactoryReset} style={styles.resetBtn}>
            <Text style={{ fontSize: 18 }}>🗑️</Text>
            <Text style={styles.resetText}>Factory Reset (Delete All)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backBtn: { marginRight: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  scroll: { padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888780',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAF3DE',
  },
  statLabel: { fontSize: 12, color: '#888780', marginBottom: 4 },
  statVal: { fontSize: 18, fontWeight: '700', color: '#0A6E2E' },
  logContainer: {
    backgroundColor: '#121815',
    borderRadius: 12,
    padding: 12,
  },
  emptyLog: { color: '#8B948F', fontSize: 12, textAlign: 'center' },
  logItem: { marginBottom: 10, borderBottomWidth: 0.5, borderBottomColor: '#293330', paddingBottom: 8 },
  logTime: { color: '#0E9F6E', fontSize: 10, fontWeight: '700' },
  logBody: { color: '#F2F5F3', fontSize: 11, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  btnText: { fontWeight: '700', fontSize: 13 },
  importBox: { marginTop: 12, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#D3D1C7' },
  importInput: { height: 100, textAlignVertical: 'top', fontSize: 12, color: '#2C2C2A' },
  submitImport: { backgroundColor: '#0A6E2E', padding: 12, borderRadius: 8, marginTop: 8, alignItems: 'center' },
  submitImportText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCE4E4',
    gap: 8,
  },
  resetText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },
});
