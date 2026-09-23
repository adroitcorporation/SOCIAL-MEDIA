'use client';
import { useState } from 'react';

export function ProfileSelect({
  name,
  label,
  value,
  options,
  maxLength,
  error,
  onChange,
  onBlur,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
  maxLength: number;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const [other, setOther] = useState(() => Boolean(value && !options.includes(value)));
  return (
    <div className="profile-single-select">
      <label htmlFor={`profile-${name}`}>{label} (required)</label>
      <select
        id={`profile-${name}`}
        name={other ? undefined : name}
        required
        value={other ? '__other__' : value}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `profile-${name}-error` : undefined}
        onChange={(event) => {
          const selected = event.target.value;
          setOther(selected === '__other__');
          onChange(selected === '__other__' ? '' : selected);
        }}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value="__other__">Other</option>
      </select>
      {other && (
        <label className="profile-custom-value">
          Specify {label.toLowerCase()} (required)
          <input
            name={name}
            value={value}
            required
            maxLength={maxLength}
            onBlur={onBlur}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `profile-${name}-error` : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      )}
      {error && (
        <p id={`profile-${name}-error`} className="error profile-field-error">
          {error}
        </p>
      )}
    </div>
  );
}
