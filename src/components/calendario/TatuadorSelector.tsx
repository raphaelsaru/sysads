'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface TatuadorOption {
  id: string
  full_name: string | null
}

interface TatuadorSelectorProps {
  options: TatuadorOption[]
  value: string | null
  onChange: (userId: string) => void
}

export default function TatuadorSelector({ options, value, onChange }: TatuadorSelectorProps) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full max-w-xs">
        <SelectValue placeholder="Selecione um tatuador" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.full_name || 'Sem nome'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
