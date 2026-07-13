import { forwardRef, type InputHTMLAttributes } from 'react';
import { MinusIcon, PlusIcon } from './Icons';

interface NumberStepperProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max' | 'step'> {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export const NumberStepper = forwardRef<HTMLInputElement, NumberStepperProps>(function NumberStepper({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  className = '',
  ...inputProps
}, ref) {
  const update = (direction: -1 | 1) => {
    const current = Number.isFinite(value) ? value : (min ?? 0);
    const next = current + step * direction;
    onValueChange(Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, next)));
  };
  const label = inputProps['aria-label'] ?? '숫자 값';

  return <div className={`number-stepper ${suffix ? 'has-suffix' : 'no-suffix'} ${disabled ? 'disabled' : ''} ${className}`.trim()}>
    <button type="button" className="number-stepper-button" aria-label={`${label} 감소`} disabled={disabled || (min != null && value <= min)} onClick={() => update(-1)}><MinusIcon /></button>
    <input {...inputProps} ref={ref} type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onValueChange(Number(event.target.value))} />
    {suffix && <span className="number-stepper-suffix">{suffix}</span>}
    <button type="button" className="number-stepper-button" aria-label={`${label} 증가`} disabled={disabled || (max != null && value >= max)} onClick={() => update(1)}><PlusIcon /></button>
  </div>;
});
