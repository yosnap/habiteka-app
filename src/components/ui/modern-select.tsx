'use client';

import { Children, Fragment, isValidElement, useState, type ChangeEvent, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Select } from 'radix-ui';
import styles from './modern-select.module.css';

type Props = ComponentPropsWithoutRef<'select'> & { compact?: boolean; popoverZIndex?: number; portalContainer?: HTMLElement | null };
interface OptionItem { value: string; label: ReactNode; disabled: boolean; group?: string; }

/** Select con popover propio; acepta option/optgroup para preservar la API actual. */
export function ModernSelect({ children, className = '', compact = false, popoverZIndex = 100, portalContainer, value, defaultValue, onChange, disabled, name, ...props }: Props) {
  const options = readOptions(children);
  const [uncontrolledValue, setUncontrolledValue] = useState(() => String(defaultValue ?? options[0]?.value ?? ''));
  const current = value !== undefined ? String(value) : uncontrolledValue;
  // Radix reserva el string vacío para el placeholder; HTML lo usa para «Todos».
  let emptyValue = '__habiteka_empty__';
  while (options.some(item => item.value === emptyValue)) emptyValue += '_';
  const emitChange = (encoded: string) => {
    const next = encoded === emptyValue ? '' : encoded;
    if (value === undefined) setUncontrolledValue(next);
    onChange?.({ target: { value: next, name }, currentTarget: { value: next, name } } as ChangeEvent<HTMLSelectElement>);
  };
  const groups = [...new Set(options.map((item) => item.group ?? ''))];
  const triggerProps = props as unknown as ComponentPropsWithoutRef<typeof Select.Trigger>;

  return <>{name && <input type="hidden" name={name} value={current} disabled={disabled} />}
    <Select.Root value={current || emptyValue} onValueChange={emitChange} disabled={disabled}>
    <Select.Trigger className={`border-line bg-surface flex w-full items-center justify-between gap-2 rounded-control border py-1.5 pr-2 pl-2 text-left text-sm shadow-sm outline-none transition hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 ${compact ? styles.compact : ''} ${className}`} {...triggerProps}>
      <Select.Value>{options.find(item => item.value === current)?.label}</Select.Value>
      <Select.Icon><ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></Select.Icon>
    </Select.Trigger>
    <Select.Portal container={portalContainer ?? undefined}>
      <Select.Content position="popper" sideOffset={6} style={{ zIndex: popoverZIndex }} className="border-line bg-surface max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-card border shadow-xl">
        <Select.Viewport className="p-1">
          {groups.map((group) => <Select.Group key={group || '__ungrouped'}>
            {group && <Select.Label className="px-2 py-1 text-xs font-medium text-muted-foreground">{group}</Select.Label>}
            {options.filter((item) => (item.group ?? '') === group).map((item) => <Select.Item key={item.value} value={item.value || emptyValue} disabled={item.disabled} className="relative flex cursor-default items-center rounded-control py-1.5 pr-8 pl-2 text-sm outline-none data-[highlighted]:bg-primary/10 data-[state=checked]:bg-primary/15 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40">
              <Select.ItemText>{item.label}</Select.ItemText>
              <Select.ItemIndicator className="absolute right-2"><Check className="h-4 w-4 text-primary" aria-hidden="true" /></Select.ItemIndicator>
            </Select.Item>)}
          </Select.Group>)}
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root></>;
}

function readOptions(children: ReactNode, group?: string): OptionItem[] {
  return Children.toArray(children).flatMap((node) => {
    if (!isValidElement(node)) return [];
    const element = node as ReactElement<{ value?: string; disabled?: boolean; label?: string; children?: ReactNode }>;
    // Los consumidores pueden agrupar los optgroup en un fragmento. Si no se
    // atraviesa, Radix recibe cero ítems y el trigger queda visualmente vacío.
    if (element.type === Fragment) return readOptions(element.props.children, group);
    if (element.type === 'optgroup') return readOptions(element.props.children, element.props.label);
    if (element.type !== 'option') return [];
    const label = element.props.children;
    return [{ value: String(element.props.value ?? textOf(label)), label, disabled: Boolean(element.props.disabled), group }];
  });
}

function textOf(value: ReactNode): string {
  return Children.toArray(value).join('');
}
