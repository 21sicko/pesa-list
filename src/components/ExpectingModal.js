// ExpectingModal.js — Quick buttons for common fares
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, StyleSheet } from 'react-native';

const QUICK_AMOUNTS = [30, 50, 100];

export default function ExpectingModal({ visible, onClose, onSubmit, theme }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');

  const handleQuick = (amt) => {
    setAmount(amt);
    setCustomAmount('');
  };

  const handleCustom = (text) => {
    setCustomAmount(text);
    setAmount(null);
  };

  const handleSubmit = () => {
    const finalAmount = amount || (customAmount ? parseInt(customAmount, 10) : null);
    if (!name.trim()) return;
    onSubmit(name.trim(), finalAmount);
    setName('');
    setAmount(null);
    setCustomAmount('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Expecting payment from</Text>

          <TextInput
            style={[styles.input, { 
              borderColor: theme.border, 
              color: theme.textPrimary, 
              backgroundColor: theme.bg 
            }]}
            placeholder="Passenger name (e.g. JOHN)"
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Amount (optional)</Text>
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map(amt => (
              <TouchableOpacity
                key={amt}
                onPress={() => handleQuick(amt)}
                style={[styles.quickBtn, { 
                  backgroundColor: amount === amt ? theme.primary : theme.bg,
                  borderColor: amount === amt ? theme.primary : theme.border,
                }]}
              >
                <Text style={{ 
                  fontSize: 15, fontWeight: '700', 
                  color: amount === amt ? '#fff' : theme.textPrimary 
                }}>
                  Ksh {amt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.input, { 
              borderColor: theme.border, 
              color: theme.textPrimary, 
              backgroundColor: theme.bg 
            }]}
            placeholder="Or type custom amount"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            value={customAmount}
            onChangeText={handleCustom}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { backgroundColor: theme.bg }]}>
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleSubmit} 
              style={[styles.submitBtn, { backgroundColor: theme.primary }, !name.trim() && { opacity: 0.5 }]}
              disabled={!name.trim()}
            >
              <Text style={styles.submitText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 14,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  quickBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  submitBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
