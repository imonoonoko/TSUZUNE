import { useRef } from 'react'
import type { PropertyValue } from '../../shared/property-changes'

export interface PropertyValueFieldsProps {
  value: PropertyValue
  onChange: (value: PropertyValue) => void
  label: string
  disabled: boolean
  autoFocus?: boolean
}

export default function PropertyValueFields({ value, onChange, label, disabled, autoFocus = false }: PropertyValueFieldsProps): React.JSX.Element {
  const addItemRef = useRef<HTMLButtonElement>(null)
  if (value.type === 'checkbox') {
    return <input type="checkbox" aria-label={label} checked={value.value} disabled={disabled}
      autoFocus={autoFocus} onChange={(event) => onChange({ type: 'checkbox', value: event.target.checked })} />
  }
  if (value.type === 'date') {
    return <input type="date" aria-label={label} value={value.value} disabled={disabled}
      autoFocus={autoFocus} onChange={(event) => onChange({ type: 'date', value: event.target.value })} />
  }
  if (value.type === 'datetime') {
    return <input type="text" aria-label={label} value={value.value} disabled={disabled}
      autoFocus={autoFocus} placeholder="YYYY-MM-DDTHH:mm:ss+09:00"
      onChange={(event) => onChange({ type: 'datetime', value: event.target.value })} />
  }
  if (value.type !== 'list') {
    return <textarea aria-label={label} rows={2} value={value.value} disabled={disabled}
      autoFocus={autoFocus} aria-describedby={value.type === 'number' ? 'property-number-help' : undefined}
      onChange={(event) => onChange({ ...value, value: event.target.value })} />
  }
  const changeItem = (index: number, item: { type: 'text' | 'number'; value: string }): void => {
    onChange({ type: 'list', value: value.value.map((current, position) => position === index ? item : current) })
  }
  return (
    <div className="markdown-property-items">
      {value.value.map((item, index) => (
        <div className="markdown-property-item" key={index}>
          <select aria-label={`${label}の項目${index + 1}の型`} value={item.type} disabled={disabled}
            onChange={(event) => changeItem(index, { ...item, type: event.target.value as 'text' | 'number' })}>
            <option value="text">文字列</option>
            <option value="number">数値</option>
          </select>
          <textarea aria-label={`${label}の項目${index + 1}`} rows={2} value={item.value} disabled={disabled}
            autoFocus={autoFocus && index === 0}
            onChange={(event) => changeItem(index, { ...item, value: event.target.value })} />
          <button type="button" aria-label={`${label}の項目${index + 1}を削除`} disabled={disabled} onClick={() => {
            onChange({ type: 'list', value: value.value.filter((_, position) => position !== index) })
            addItemRef.current?.focus()
          }}>項目を削除</button>
        </div>
      ))}
      {value.value.length === 0 ? <span className="markdown-property-hint">空のリスト</span> : null}
      <button ref={addItemRef} type="button" aria-label={`${label}に項目を追加`} disabled={disabled}
        onClick={() => onChange({ type: 'list', value: [...value.value, { type: 'text', value: '' }] })}>項目を追加</button>
    </div>
  )
}
