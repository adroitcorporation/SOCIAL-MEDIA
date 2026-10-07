'use client';
import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import {
  searchTaxonomy,
  normalizeValue,
  selectionLimits,
  type TaxonomyField,
} from '@/shared/recommendations/taxonomy';

export function TaxonomySelect({
  field,
  label,
  values,
  onChange,
  error,
}: {
  field: TaxonomyField;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  error?: string;
}) {
  const [search, setSearch] = useState('');
  const max = selectionLimits[field];
  const options = searchTaxonomy(field, search)
    .filter((o) => !values.some((v) => normalizeValue(field, v) === o.label))
    .slice(0, 6);
  const add = (value: string) => {
    if (
      values.length >= max ||
      values.some(
        (v) =>
          normalizeValue(field, v).toLowerCase() === normalizeValue(field, value).toLowerCase(),
      )
    )
      return;
    onChange([...values, normalizeValue(field, value)]);
    setSearch('');
  };
  return (
    <fieldset
      className={`taxonomy-select tag-category-${field === 'skills' ? 'skill' : field === 'interests' ? 'interest' : 'looking'}`}
    >
      <legend>
        {label}{' '}
        <span className="muted">
          {values.length}/{max}
        </span>
      </legend>
      <div className="tags selected-chips">
        {values.map((value, index) => (
          <button
            type="button"
            className="tag"
            key={`${value}-${index}`}
            onClick={() => onChange(values.filter((_, i) => i !== index))}
            aria-label={`Remove ${value}`}
          >
            {value}
            <X size={13} />
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor={`profile-${field}`}>
        Search {label.toLowerCase()}
      </label>
      <input
        id={`profile-${field}`}
        value={search}
        maxLength={50}
        placeholder={`Search ${label.toLowerCase()}`}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (search.trim() && !options.length) add(search.trim());
            else if (options.length === 1) add(options[0].label);
          }
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={`${field}-hint${error ? ` profile-${field}-error` : ''}`}
      />
      <small id={`${field}-hint`}>
        {values.length >= max ? 'Remove a selection to add another.' : `Choose up to ${max}.`}
      </small>
      <div className="tags taxonomy-results" aria-label={`${label} suggestions`}>
        {options.map((o) => (
          <button
            type="button"
            className="tag"
            disabled={values.length >= max}
            key={o.label}
            onClick={() => add(o.label)}
          >
            <Plus size={12} />
            {o.label}
          </button>
        ))}
        {search.trim() && !options.length && !values.includes(search.trim()) && (
          <button
            type="button"
            className="tag"
            disabled={values.length >= max}
            onClick={() => add(search.trim())}
          >
            Add “{search.trim()}”
          </button>
        )}
      </div>
      {error && (
        <span id={`profile-${field}-error`} className="error profile-field-error">
          {error}
        </span>
      )}
    </fieldset>
  );
}
