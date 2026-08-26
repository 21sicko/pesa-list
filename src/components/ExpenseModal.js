// ExpenseModal.js — Track fuel, food, and other costs
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, StyleSheet } from 'react-native';

const COMMON_EXPENSES = ["FUEL", "LUNCH", "PARKING", "POLICE"];

export default function ExpenseModal({ visible, onClose, onSubmit, theme }) {
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = () => {
    if (!category.trim() || !amount) return;
    onSubmit(category.trim(), amount);
    setCategory('');
    setAmount('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Record Expense</Text>

          <Text style={[styles.label, { color: theme.textSecondary }]}>Quick Categories</Text>
          <View style={styles.quickRow}>
            {COMMON_EXPENSES.map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                style={[styles.quickBtn, {
                  backgroundColor: category === cat ? theme.primary : theme.bg,
                  borderColor: category === cat ? theme.primary : theme.border,
                }]}
              >
                <Text style={{
                  fontSize: 12, fontWeight: '700',
                  color: category === cat ? '#fff' : theme.textPrimary
                }}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.bg }]}
            placeholder="Category (e.g. TIRE REPAIR)"
            placeholderTextColor={theme.textMuted}
            value={category}
            onChangeText={setCategory}
            autoCapitalize="characters"
          />

          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.bg }]}
            placeholder="Amount (Ksh)"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            value={amount}
            onChangeText={setAmount}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { backgroundColor: theme.bg }]}>
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitBtn, { backgroundColor: theme.danger }, (!category.trim() || !amount) && { opacity: 0.5 }]}
              disabled={!category.trim() || !amount}
            >
              <Text style={styles.submitText}>Save Expense</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 14 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  quickBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700' },
  submitBtn: { flex: 2, padding: 14, borderRadius: 12, alignItems: 'center' },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
