import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect, usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { AppSettings, defaultSettings, formatGoal, getSettings, saveSettings } from '../lib/storage';
import { centered } from '../theme';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
type PasswordDraft = { current: string; next: string; confirm: string };

const pencilIcon = require('../../assets/pencil-icon.png');

export function SettingsScreen({ navigation }: Props) {
  const styles = useStyles(makeStyles);
  const [saved, setSaved] = useState<AppSettings>(defaultSettings);
  const [draft, setDraft] = useState<AppSettings>(defaultSettings);
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>({ current: '', next: '', confirm: '' });
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSettings().then((next) => {
        if (active) {
          setSaved(next);
          setDraft(next);
        }
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const changes = useMemo(
    () => describeChanges(saved, draft, passwordDraft),
    [saved, draft, passwordDraft]
  );
  const hasChanges = changes.length > 0;

  usePreventRemove(hasChanges, ({ data }) => {
    Alert.alert('尚未儲存', '離開會遺失尚未儲存的修改。', [
      { text: '繼續編輯', style: 'cancel' },
      { text: '放棄修改', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  function updateDraft(next: AppSettings) {
    setDraft(next);
    setError('');
    setSuccess('');
  }

  function updateGoal(partial: Partial<Pick<AppSettings, 'goalUnit' | 'goalPeriod' | 'goalWordCount'>>) {
    const next = { ...draft, ...partial };
    updateDraft({ ...next, personalGoal: formatGoal(next.goalUnit, next.goalPeriod, next.goalWordCount) });
  }

  function updatePassword(next: PasswordDraft) {
    setPasswordDraft(next);
    setError('');
    setSuccess('');
  }

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('需要相簿權限才能上傳大頭貼。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) updateDraft({ ...draft, avatarUri: result.assets[0].uri });
  }

  function cancelChanges() {
    if (!hasChanges) return;
    Alert.alert('取消修改', '要放棄目前尚未儲存的修改嗎？', [
      { text: '繼續編輯', style: 'cancel' },
      {
        text: '放棄修改',
        style: 'destructive',
        onPress: () => {
          setDraft(saved);
          setPasswordDraft({ current: '', next: '', confirm: '' });
          setError('');
          setSuccess('');
        },
      },
    ]);
  }

  async function saveChanges() {
    const displayName = draft.displayName.trim();
    const accountEmail = draft.accountEmail.trim();
    const wantsPasswordChange = Boolean(passwordDraft.current || passwordDraft.next || passwordDraft.confirm);

    if (displayName.length < 2) {
      setError('顯示名稱至少需要 2 個字。');
      return;
    }
    if (displayName.length > 24) {
      setError('顯示名稱最多 24 個字。');
      return;
    }
    if (accountEmail && !/^\S+@\S+\.\S+$/.test(accountEmail)) {
      setError('請輸入有效的電子信箱。');
      return;
    }
    if (wantsPasswordChange) {
      if (!passwordDraft.current) {
        setError('請輸入目前密碼。');
        return;
      }
      if (passwordDraft.next.length < 8) {
        setError('新密碼至少需要 8 個字。');
        return;
      }
      if (passwordDraft.next !== passwordDraft.confirm) {
        setError('兩次輸入的新密碼不一致。');
        return;
      }
    }
    if (draft.goalPeriod < 1 || draft.goalPeriod > 52) {
      setError('目標期間請輸入 1 到 52。');
      return;
    }
    if (draft.goalWordCount < 1 || draft.goalWordCount > 3000) {
      setError('單字數請輸入 1 到 3000。');
      return;
    }

    const next = {
      ...draft,
      displayName,
      accountEmail,
      personalGoal: formatGoal(draft.goalUnit, draft.goalPeriod, draft.goalWordCount),
    };
    await saveSettings(next);
    setSaved(next);
    setDraft(next);
    setPasswordDraft({ current: '', next: '', confirm: '' });
    setError('');
    setSuccess(wantsPasswordChange ? '設定已儲存；密碼欄位已清空。' : '設定已儲存。');
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>設定</Text>

        <View style={styles.accountCard}>
          <View style={styles.avatar}>
            {draft.avatarUri ? (
              <Image source={{ uri: draft.avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{draft.displayName.trim()[0]?.toUpperCase() ?? 'G'}</Text>
            )}
          </View>
          <View style={styles.accountText}>
            <Text style={styles.accountName}>{draft.displayName}</Text>
            <Text style={styles.accountMeta}>{draft.accountEmail || '尚未設定帳號信箱'}</Text>
          </View>
          <Pressable style={styles.iconButton} onPress={() => setAccountOpen(true)} accessibilityLabel="編輯帳號">
            <Image source={pencilIcon} style={styles.pencilIcon} />
          </Pressable>
        </View>

        <Section title="個人目標">
          <View style={styles.goalBox}>
            <View style={styles.goalSentence}>
              <NumberInput value={draft.goalPeriod} onChange={(goalPeriod) => updateGoal({ goalPeriod })} />
              <UnitToggle value={draft.goalUnit} onChange={(goalUnit) => updateGoal({ goalUnit })} />
              <Text style={styles.goalWord}>背</Text>
              <NumberInput value={draft.goalWordCount} onChange={(goalWordCount) => updateGoal({ goalWordCount })} wide />
              <Text style={styles.goalWord}>個單字</Text>
            </View>
            <View style={styles.goalPreview}>
              <Text style={styles.goalPreviewText}>{draft.personalGoal}</Text>
            </View>
          </View>
        </Section>

        <Section title="通知">
          <SettingSwitch
            title="複習提醒"
            meta="之後接通知服務時，用來提醒今日待複習單字。"
            value={draft.reviewNotifications}
            onValueChange={(value) => updateDraft({ ...draft, reviewNotifications: value })}
          />
          <SettingSwitch
            title="連續學習提醒"
            meta="快中斷 streak 時提醒你回來補一輪。"
            value={draft.streakNotifications}
            onValueChange={(value) => updateDraft({ ...draft, streakNotifications: value })}
          />
        </Section>

        <Section title="練習">
          <SettingSwitch
            title="答題後顯示其他選項答案"
            meta="選英文時會一起看到其他選項的中文意思。"
            value={draft.autoShowChoiceAnswers}
            onValueChange={(value) => updateDraft({ ...draft, autoShowChoiceAnswers: value })}
          />
          <SettingSwitch
            title="出題時自動唸英文"
            meta="「英選中」的題目一出現就唸一次，不用自己按喇叭。其他題型的答案是英文，所以不唸。"
            value={draft.autoSpeakQuestion}
            onValueChange={(value) => updateDraft({ ...draft, autoSpeakQuestion: value })}
          />
          <SettingSwitch
            title="答題後自動唸"
            meta="翻開解析就自動播，唸哪幾段自己勾。"
            value={draft.autoSpeakAfterAnswer}
            onValueChange={(value) => updateDraft({ ...draft, autoSpeakAfterAnswer: value })}
          />
          {draft.autoSpeakAfterAnswer && (
            <SpeakParts draft={draft} onChange={updateDraft} />
          )}
        </Section>

        <Section title="資料">
          <SettingLink title="學習統計" meta="查看盒子分布與已排除字數。" onPress={() => navigation.navigate('Stats')} />
          <SettingLink title="已熟悉字庫" meta="管理標成太簡單、被移出複習佇列的單字。" onPress={() => navigation.navigate('Excluded')} />
        </Section>

        <Section title="關於">
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>GRE 單字</Text>
              <Text style={styles.rowMeta}>離線單字庫與本機 Leitner 複習。</Text>
            </View>
            <Text style={styles.version}>1.0.0</Text>
          </View>
        </Section>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {hasChanges && (
          <View style={styles.changesCard}>
            <Text style={styles.changesTitle}>即將儲存的修改</Text>
            {changes.map((change) => (
              <Text key={change} style={styles.changeItem}>• {change}</Text>
            ))}
            <View style={styles.actions}>
              <Pressable style={styles.cancelButton} onPress={cancelChanges}>
                <Text style={styles.cancelText}>取消修改</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={saveChanges}>
                <Text style={styles.saveText}>儲存</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <AccountEditor
        visible={accountOpen}
        draft={draft}
        passwordDraft={passwordDraft}
        onClose={() => setAccountOpen(false)}
        onPickAvatar={pickAvatar}
        onChange={updateDraft}
        onPasswordChange={updatePassword}
      />
    </>
  );
}

function describeChanges(saved: AppSettings, draft: AppSettings, passwordDraft: PasswordDraft): string[] {
  const changes: string[] = [];
  if (saved.displayName !== draft.displayName) changes.push(`顯示名稱：${saved.displayName} → ${draft.displayName || '未填寫'}`);
  if (saved.accountEmail !== draft.accountEmail) changes.push(`帳號信箱：${saved.accountEmail || '未設定'} → ${draft.accountEmail || '未設定'}`);
  if (saved.avatarUri !== draft.avatarUri) changes.push('大頭貼已更新');
  if (saved.googleLinked !== draft.googleLinked) changes.push(`Google 綁定：${draft.googleLinked ? '已綁定' : '未綁定'}`);
  if (saved.personalGoal !== draft.personalGoal) changes.push(`個人目標：${saved.personalGoal} → ${draft.personalGoal}`);
  if (passwordDraft.current || passwordDraft.next || passwordDraft.confirm) changes.push('帳號密碼將更新');
  if (saved.reviewNotifications !== draft.reviewNotifications) changes.push(`複習提醒：${draft.reviewNotifications ? '開啟' : '關閉'}`);
  if (saved.streakNotifications !== draft.streakNotifications) changes.push(`連續學習提醒：${draft.streakNotifications ? '開啟' : '關閉'}`);
  if (saved.autoShowChoiceAnswers !== draft.autoShowChoiceAnswers) changes.push(`顯示其他選項答案：${draft.autoShowChoiceAnswers ? '開啟' : '關閉'}`);
  if (saved.autoSpeakQuestion !== draft.autoSpeakQuestion) changes.push(`出題時自動唸英文：${draft.autoSpeakQuestion ? '開啟' : '關閉'}`);
  if (saved.autoSpeakAfterAnswer !== draft.autoSpeakAfterAnswer) changes.push(`答題後自動唸：${draft.autoSpeakAfterAnswer ? '開啟' : '關閉'}`);
  const partsBefore = describeSpeakParts(saved);
  const partsAfter = describeSpeakParts(draft);
  if (draft.autoSpeakAfterAnswer && partsBefore !== partsAfter) changes.push(`答題後唸的內容：${partsAfter}`);
  return changes;
}

function AccountEditor({
  visible,
  draft,
  passwordDraft,
  onClose,
  onPickAvatar,
  onChange,
  onPasswordChange,
}: {
  visible: boolean;
  draft: AppSettings;
  passwordDraft: PasswordDraft;
  onClose: () => void;
  onPickAvatar: () => void;
  onChange: (settings: AppSettings) => void;
  onPasswordChange: (draft: PasswordDraft) => void;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>帳號資料</Text>
          <Pressable style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneText}>完成</Text>
          </Pressable>
        </View>

        <Pressable style={styles.avatarEditor} onPress={onPickAvatar}>
          {draft.avatarUri ? (
            <Image source={{ uri: draft.avatarUri }} style={styles.avatarEditorImage} />
          ) : (
            <Text style={styles.avatarEditorText}>{draft.displayName.trim()[0]?.toUpperCase() ?? 'G'}</Text>
          )}
          <Text style={styles.avatarEditorMeta}>更換大頭貼</Text>
        </Pressable>

        <Field label="用戶名稱">
          <TextInput
            value={draft.displayName}
            onChangeText={(displayName) => onChange({ ...draft, displayName })}
            maxLength={24}
            style={styles.input}
            placeholder="輸入顯示名稱"
            placeholderTextColor={theme.colors.muted}
          />
        </Field>

        <Field label="帳號信箱">
          <TextInput
            value={draft.accountEmail}
            onChangeText={(accountEmail) => onChange({ ...draft, accountEmail })}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            placeholder="name@example.com"
            placeholderTextColor={theme.colors.muted}
          />
        </Field>

        <Field label="帳號密碼">
          <TextInput
            value={passwordDraft.current}
            onChangeText={(current) => onPasswordChange({ ...passwordDraft, current })}
            secureTextEntry
            style={styles.input}
            placeholder="目前密碼"
            placeholderTextColor={theme.colors.muted}
          />
          <TextInput
            value={passwordDraft.next}
            onChangeText={(next) => onPasswordChange({ ...passwordDraft, next })}
            secureTextEntry
            style={styles.input}
            placeholder="新密碼"
            placeholderTextColor={theme.colors.muted}
          />
          <TextInput
            value={passwordDraft.confirm}
            onChangeText={(confirm) => onPasswordChange({ ...passwordDraft, confirm })}
            secureTextEntry
            style={styles.input}
            placeholder="再次輸入新密碼"
            placeholderTextColor={theme.colors.muted}
          />
        </Field>

        <View style={styles.googleCard}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Google</Text>
            <Text style={styles.rowMeta}>{draft.googleLinked ? '已綁定 Google 帳號。' : '使用 Google 登入與同步時會用到。'}</Text>
          </View>
          <Pressable
            style={[styles.googleButton, draft.googleLinked && styles.googleButtonActive]}
            onPress={() => onChange({ ...draft, googleLinked: !draft.googleLinked })}
          >
            <Text style={[styles.googleButtonText, draft.googleLinked && styles.googleButtonTextActive]}>
              {draft.googleLinked ? '解除' : '綁定'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function NumberInput({ value, onChange, wide = false }: { value: number; onChange: (value: number) => void; wide?: boolean }) {
  const styles = useStyles(makeStyles);
  return (
    <TextInput
      value={String(value)}
      onChangeText={(text) => onChange(Number(text.replace(/\D/g, '')) || 0)}
      keyboardType="number-pad"
      maxLength={4}
      style={[styles.inlineNumber, wide && styles.inlineNumberWide]}
    />
  );
}

function UnitToggle({ value, onChange }: { value: AppSettings['goalUnit']; onChange: (value: AppSettings['goalUnit']) => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.unitToggle}>
      {(['week', 'day'] as const).map((unit) => (
        <Pressable
          key={unit}
          style={[styles.unitPill, value === unit && styles.unitPillActive]}
          onPress={() => onChange(unit)}
        >
          <Text style={[styles.unitText, value === unit && styles.unitTextActive]}>{unit === 'week' ? '週' : '天'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// The four segments of the reading after an answer, in the order they play.
const SPEAK_PARTS = [
  { key: 'speakAnswerWord', label: '英文單字' },
  { key: 'speakAnswerMeaning', label: '中文意思' },
  { key: 'speakAnswerExample', label: '英文例句' },
  { key: 'speakAnswerExampleZh', label: '中文翻譯' },
] as const;

function describeSpeakParts(settings: AppSettings): string {
  const on = SPEAK_PARTS.filter((part) => settings[part.key]).map((part) => part.label);
  return on.length > 0 ? on.join('、') : '沒有勾任何一段，等於關閉';
}

function SpeakParts({ draft, onChange }: { draft: AppSettings; onChange: (next: AppSettings) => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.partsRow}>
      {SPEAK_PARTS.map((part) => {
        const on = draft[part.key];
        return (
          <Pressable
            key={part.key}
            style={[styles.partPill, on && styles.partPillOn]}
            onPress={() => {
              const next = { ...draft, [part.key]: !on };
              // The translation is read straight after the sentence it
              // translates, so on its own it has nothing to follow and would
              // silently play nothing. Ticking it brings the sentence along.
              if (part.key === 'speakAnswerExampleZh' && !on) next.speakAnswerExample = true;
              if (part.key === 'speakAnswerExample' && on) next.speakAnswerExampleZh = false;
              onChange(next);
            }}
          >
            <Text style={[styles.partMark, on && styles.partMarkOn]}>{on ? '✓' : ''}</Text>
            <Text style={[styles.partText, on && styles.partTextOn]}>{part.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

function Section({ title, children }: SectionProps) {
  const styles = useStyles(makeStyles);
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.panel}>{children}</View>
    </View>
  );
}

type SwitchProps = {
  title: string;
  meta: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

function SettingSwitch({ title, meta, value, onValueChange }: SwitchProps) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        // On was a green thumb on a green track: one green lozenge, and no way
        // to read which end the knob was at. Every pastel in this palette
        // carries its own ink, so the knob borrows it — a dark green dot on
        // pale green says "on" by shape as well as by colour.
        trackColor={{ false: theme.colors.line, true: theme.colors.green }}
        thumbColor={value ? theme.colors.greenInk : theme.colors.surface}
        ios_backgroundColor={theme.slabEdge.line}
      />
    </View>
  );
}

type LinkProps = {
  title: string;
  meta: string;
  onPress: () => void;
};

function SettingLink({ title, meta, onPress }: LinkProps) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1 },
  content: { ...centered, padding: 20, paddingBottom: 40, gap: 16 },
  eyebrow: { color: t.colors.blueInk, fontSize: 14, fontWeight: '900' },
  accountCard: {
    backgroundColor: t.glass.solid,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.glass.edge,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: t.colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { color: t.colors.blueInk, fontSize: 26, fontWeight: '900' },
  avatarImage: { width: 54, height: 54, borderRadius: 27 },
  accountText: { flex: 1 },
  accountName: { color: t.colors.ink, fontSize: 18, fontWeight: '900' },
  accountMeta: { color: t.colors.muted, fontSize: 13, fontWeight: '700', marginTop: 4 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: t.colors.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pencilIcon: { width: 23, height: 23, resizeMode: 'contain' },
  sectionTitle: { color: t.colors.muted, fontSize: 13, fontWeight: '900', marginBottom: 8, marginLeft: 4 },
  panel: { backgroundColor: t.glass.solid, borderRadius: 24, borderWidth: 1, borderColor: t.glass.edge, overflow: 'hidden' },
  goalBox: { padding: 18, gap: 14 },
  goalSentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  goalWord: { color: t.colors.ink, fontSize: 18, fontWeight: '900' },
  inlineNumber: {
    // A width, not a minWidth: on web this renders as an <input>, and an
    // <input> carries a browser-default width that a minWidth never overrides.
    // Left as minWidth the two boxes grew to about 180px each and shoved
    // "個單字" off the right edge of the phone.
    width: 56,
    height: 36,
    borderRadius: 14,
    backgroundColor: t.colors.inset,
    color: t.colors.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 8,
    marginHorizontal: 4,
  },
  inlineNumberWide: { width: 76 },
  unitToggle: {
    height: 36,
    borderRadius: 14,
    backgroundColor: t.colors.inset,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginHorizontal: 4,
    padding: 3,
  },
  unitPill: { minWidth: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  unitPillActive: { backgroundColor: t.colors.blue },
  unitText: { color: t.colors.muted, fontWeight: '900' },
  unitTextActive: { color: t.colors.blueInk },
  // Sits under the switch it belongs to, inside the same panel, so the four
  // boxes read as part of that row rather than as a setting of their own.
  partsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 18,
    marginTop: -4,
    borderBottomWidth: 1,
    borderBottomColor: t.glass.edge,
  },
  partPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: t.colors.inset,
    borderWidth: 1.5,
    borderColor: t.slabEdge.line,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  partPillOn: { backgroundColor: t.colors.green, borderColor: t.slabEdge.green },
  // Holds its width whether or not there is a tick in it, so ticking a box
  // does not shuffle the row.
  partMark: { width: 13, fontSize: 13, fontWeight: '900', color: 'transparent' },
  partMarkOn: { color: t.colors.greenInk },
  partText: { color: t.colors.muted, fontSize: 14, fontWeight: '900' },
  partTextOn: { color: t.colors.greenInk },
  goalPreview: { backgroundColor: t.colors.blue, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  goalPreviewText: { color: t.colors.blueInk, fontSize: 15, fontWeight: '900' },
  row: {
    minHeight: 84,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: t.glass.edge,
  },
  rowText: { flex: 1, paddingRight: 16 },
  rowTitle: { color: t.colors.ink, fontSize: 16, fontWeight: '900' },
  rowMeta: { color: t.colors.muted, fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 6 },
  chevron: { color: t.colors.muted, fontSize: 30, fontWeight: '300' },
  version: { color: t.colors.muted, fontSize: 14, fontWeight: '900' },
  error: { color: t.colors.redInk, fontWeight: '900', lineHeight: 20 },
  success: { color: t.colors.greenInk, fontWeight: '900', lineHeight: 20 },
  changesCard: {
    backgroundColor: t.glass.solid,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.glass.edge,
    padding: 18,
    gap: 8,
  },
  changesTitle: { color: t.colors.ink, fontSize: 16, fontWeight: '900' },
  changeItem: { color: t.colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelButton: { flex: 1, backgroundColor: t.colors.red, borderRadius: 18, paddingVertical: 13, alignItems: 'center' },
  cancelText: { color: t.colors.redInk, fontWeight: '900' },
  saveButton: { flex: 1, backgroundColor: t.colors.blue, borderRadius: 18, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: t.colors.blueInk, fontWeight: '900' },
  modalContainer: { flex: 1, backgroundColor: t.colors.page },
  modalContent: { padding: 20, paddingBottom: 40, gap: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: t.colors.ink, fontSize: 22, fontWeight: '900' },
  doneButton: { backgroundColor: t.colors.blue, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  doneText: { color: t.colors.blueInk, fontWeight: '900' },
  avatarEditor: {
    backgroundColor: t.glass.solid,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.glass.edge,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  avatarEditorImage: { width: 96, height: 96, borderRadius: 48 },
  avatarEditorText: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: t.colors.tint,
    color: t.colors.blueInk,
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 96,
  },
  avatarEditorMeta: { color: t.colors.blueInk, fontSize: 14, fontWeight: '900' },
  field: {
    backgroundColor: t.glass.solid,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.glass.edge,
    padding: 16,
    gap: 10,
  },
  fieldLabel: { color: t.colors.muted, fontSize: 13, fontWeight: '900' },
  input: {
    minHeight: 48,
    backgroundColor: t.colors.inset,
    borderRadius: 16,
    color: t.colors.ink,
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 14,
  },
  googleCard: {
    minHeight: 84,
    backgroundColor: t.glass.solid,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.glass.edge,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleButton: { backgroundColor: t.colors.blue, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  googleButtonActive: { backgroundColor: t.colors.blue },
  googleButtonText: { color: t.colors.blueInk, fontWeight: '900' },
  googleButtonTextActive: { color: t.colors.blueInk },
});
