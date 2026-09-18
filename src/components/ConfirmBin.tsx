import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import type { Theme } from '../theme';
import { useStyles } from '../lib/useTheme';

type Props = {
  message: string;
  // The one line of context the reader needs before agreeing — where the word
  // ends up. Left out when the screen already says it.
  note?: string;
  onCancel: () => void;
  onConfirm: (dontAskAgain: boolean) => void;
};

// Rendered only while it is asking, so the checkbox starts unticked every time
// rather than remembering the last answer.
export function ConfirmBin({ message, note, onCancel, onConfirm }: Props) {
  const styles = useStyles(makeStyles);
  const [dontAsk, setDontAsk] = useState(false);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Swallows the press so a tap inside the sheet is not a tap outside it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.message}>{message}</Text>
          {note && <Text style={styles.note}>{note}</Text>}

          <Pressable
            style={styles.checkRow}
            onPress={() => setDontAsk(!dontAsk)}
            accessibilityLabel="不要再詢問"
            hitSlop={6}
          >
            <View style={[styles.box, dontAsk && styles.boxOn]}>
              {dontAsk && <Text style={styles.tick}>✓</Text>}
            </View>
            <Text style={styles.checkText}>不要再詢問</Text>
          </Pressable>

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onCancel} accessibilityLabel="取消">
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable
              style={styles.confirm}
              onPress={() => onConfirm(dontAsk)}
              accessibilityLabel="確定"
            >
              <Text style={styles.confirmText}>確定</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(18,33,50,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: t.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: t.colors.line,
    ...t.shadow,
    padding: 22,
  },
  message: { color: t.colors.ink, fontSize: 17, fontWeight: '900', lineHeight: 25 },
  note: { color: t.colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 20, marginTop: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: t.slabEdge.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: t.colors.blue, borderColor: t.slabEdge.blue },
  tick: { color: t.colors.blueInk, fontSize: 12, fontWeight: '900' },
  checkText: { color: t.colors.muted, fontSize: 14, fontWeight: '800' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancel: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 16 },
  cancelText: { color: t.colors.muted, fontSize: 15, fontWeight: '900' },
  confirm: {
    ...t.slab(t.slabEdge.red),
    backgroundColor: t.colors.red,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 16,
  },
  confirmText: { color: t.colors.redInk, fontSize: 15, fontWeight: '900' },
});
