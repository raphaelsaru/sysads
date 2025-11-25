'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isValidHexColor, normalizeHexColor } from '@/lib/color-utils'

interface ColorPickerProps {
  label: string
  value: string
  onChange: (color: string) => void
  id?: string
}

export default function ColorPicker({ label, value, onChange, id }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setHexInput(value)
  }, [value])

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    setHexInput(input)

    // Validar e normalizar
    if (isValidHexColor(input)) {
      const normalized = normalizeHexColor(input)
      onChange(normalized)
      setError(null)
    } else if (input === '') {
      setError(null)
    } else {
      setError('Cor inválida. Use formato #RRGGBB')
    }
  }

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value
    setHexInput(color)
    onChange(color)
    setError(null)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            type="text"
            value={hexInput}
            onChange={handleHexChange}
            placeholder="#3b82f6"
            className={error ? 'border-destructive' : ''}
          />
          {error && (
            <p className="text-xs text-destructive mt-1">{error}</p>
          )}
        </div>
        <div className="relative">
          <input
            type="color"
            value={normalizeHexColor(hexInput)}
            onChange={handleColorPickerChange}
            className="w-12 h-10 rounded-md border-2 border-border cursor-pointer"
            style={{ padding: '2px' }}
          />
        </div>
      </div>
      <div 
        className="h-8 rounded-md border-2 border-border"
        style={{ backgroundColor: normalizeHexColor(hexInput) }}
      />
    </div>
  )
}







