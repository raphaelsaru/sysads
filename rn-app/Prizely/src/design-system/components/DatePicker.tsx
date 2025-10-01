import { useState } from 'react'
import { Platform, Pressable, View, Modal, StyleSheet, ScrollView } from 'react-native'
import { Picker } from '@react-native-picker/picker'

import { Typography } from './Typography'
import { Button } from './Button'
import { usePrizelyTheme } from '../ThemeProvider'

export interface DatePickerProps {
  value: Date
  onChange: (date: Date) => void
  placeholder?: string
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month + 1, 0).getDate()
}

export const DatePicker = ({ value, onChange, placeholder = 'Selecione uma data' }: DatePickerProps) => {
  const theme = usePrizelyTheme()
  const [show, setShow] = useState(false)
  const [tempDay, setTempDay] = useState(value.getDate())
  const [tempMonth, setTempMonth] = useState(value.getMonth())

  const handleConfirm = () => {
    const currentYear = new Date().getFullYear()
    const daysInMonth = getDaysInMonth(tempMonth, currentYear)
    const adjustedDay = Math.min(tempDay, daysInMonth)

    const newDate = new Date(currentYear, tempMonth, adjustedDay)
    onChange(newDate)
    setShow(false)
  }

  const handleCancel = () => {
    setTempDay(value.getDate())
    setTempMonth(value.getMonth())
    setShow(false)
  }

  const handleOpen = () => {
    setTempDay(value.getDate())
    setTempMonth(value.getMonth())
    setShow(true)
  }

  const formattedDate = value.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
  })

  const currentYear = new Date().getFullYear()
  const daysInCurrentMonth = getDaysInMonth(tempMonth, currentYear)
  const days = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1)

  // Se for web, mostrar apenas o texto
  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: theme.colors.input,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
          backgroundColor: theme.colors.card,
        }}
      >
        <Typography variant="body">{formattedDate}</Typography>
      </View>
    )
  }

  return (
    <View>
      <Pressable
        onPress={handleOpen}
        style={{
          borderWidth: 1,
          borderColor: theme.colors.input,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
          backgroundColor: theme.colors.card,
        }}
      >
        <Typography variant="body" tone={value ? undefined : 'muted'}>
          {value ? formattedDate : placeholder}
        </Typography>
      </Pressable>

      <Modal visible={show} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={handleCancel}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.header}>
              <Typography variant="titleMd">Selecione a data</Typography>
            </View>

            <View style={styles.pickerContainer}>
              <View style={styles.pickerWrapper}>
                <Typography variant="caption" tone="muted" style={styles.pickerLabel}>
                  Dia
                </Typography>
                <Picker
                  selectedValue={tempDay}
                  onValueChange={(itemValue) => setTempDay(itemValue)}
                  style={[styles.picker, { color: theme.colors.foreground }]}
                  itemStyle={styles.pickerItem}
                >
                  {days.map((day) => (
                    <Picker.Item key={day} label={String(day)} value={day} />
                  ))}
                </Picker>
              </View>

              <View style={styles.pickerWrapper}>
                <Typography variant="caption" tone="muted" style={styles.pickerLabel}>
                  Mês
                </Typography>
                <Picker
                  selectedValue={tempMonth}
                  onValueChange={(itemValue) => setTempMonth(itemValue)}
                  style={[styles.picker, { color: theme.colors.foreground }]}
                  itemStyle={styles.pickerItem}
                >
                  {MESES.map((mes, index) => (
                    <Picker.Item key={index} label={mes} value={index} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={[styles.buttonContainer, { gap: theme.spacing.md }]}>
              <Button variant="outline" onPress={handleCancel} style={{ flex: 1 }}>
                Cancelar
              </Button>
              <Button onPress={handleConfirm} style={{ flex: 1 }}>
                Confirmar
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 20,
  },
  pickerWrapper: {
    flex: 1,
  },
  pickerLabel: {
    marginBottom: 8,
    textAlign: 'center',
  },
  picker: {
    height: 180,
  },
  pickerItem: {
    height: 180,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 20,
  },
})
