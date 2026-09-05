import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors } from '../theme/colors';

export interface ButtonBinding {
  id: string;
  label: string;
  key: string;
}

interface RebindModalProps {
  visible: boolean;
  binding: ButtonBinding | null;
  onSave: (id: string, newLabel: string, newKey: string) => void;
  onClose: () => void;
}

export const RebindModal: React.FC<RebindModalProps> = ({
  visible,
  binding,
  onSave,
  onClose,
}) => {
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');

  useEffect(() => {
    if (binding) {
      setLabel(binding.label);
      setKey(binding.key);
    }
  }, [binding]);

  if (!binding) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Rebind Button [{binding.id}]</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Display Label / Action Name</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. JUMP, FIRE, RELOAD"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Target PC Key / Action Code</Text>
            <TextInput
              style={styles.input}
              value={key}
              onChangeText={setKey}
              placeholder="e.g. space, mouse_left, shift, r"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
            <Text style={styles.hint}>
              Supports: space, shift, ctrl, alt, tab, esc, mouse_left, mouse_right, or letters
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => {
                onSave(binding.id, label.trim(), key.trim());
                onClose();
              }}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1c1d29',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderHighlight,
    padding: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 16,
    textAlign: 'center',
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#101117',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    color: Colors.textMain,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#262836',
  },
  cancelBtnText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.accent,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
