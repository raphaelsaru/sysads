'use client';

import { NumericFormat } from 'react-number-format';

interface MoneyInputProps {
  value?: string | number;
  onChangeValue?: (value: number | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
}

export default function MoneyInput({
  value,
  onChangeValue,
  placeholder = "R$ 0,00",
  className = "form-control",
  disabled = false,
  id,
  name
}: MoneyInputProps) {
  return (
    <NumericFormat
      id={id}
      name={name}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onValueChange={(values) => {
        const { floatValue } = values;
        onChangeValue?.(floatValue);
      }}
      // Configurações de formatação brasileira
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={2}
      fixedDecimalScale={true}
      prefix="R$ "
      allowNegative={false}
      allowLeadingZeros={false}
    />
  );
}