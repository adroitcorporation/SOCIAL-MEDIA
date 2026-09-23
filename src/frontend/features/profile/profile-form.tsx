'use client';
import { useState } from 'react';
import type { Student } from '@/shared/contracts/responses';
import type { ProfileUpdateRequest } from '@/shared/contracts/requests';
import { Avatar, Verified, Tag, ExternalLink } from '@/frontend/components/ui';
import { profileSchema } from '@/shared/contracts/schemas';
import { cities, degrees, graduationYears, profileListOptions } from './profile-options';
import { ProfileSelect } from './profile-select';
type Save = (body: ProfileUpdateRequest) => Promise<void>;
const listFields = ['skills', 'interests', 'domains', 'lookingFor'] as const;
const labels = {
  skills: 'Skills',
  interests: 'Interests',
  domains: 'Domains',
  lookingFor: 'Looking for',
};
const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
export function ProfileForm({ user, save }: { user: Student; save: Save }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState(() => ({
    name: user.name,
    college: user.college,
    degree: user.degree,
    graduationYear: String(user.graduationYear ?? ''),
    city: user.city,
    bio: user.bio,
    photo: user.photo,
    skills: user.skills.join(', '),
    interests: user.interests.join(', '),
    domains: user.domains.join(', '),
    lookingFor: user.lookingFor.join(', '),
    linkedin: user.linkedin,
    github: user.github,
    instagram: user.instagram,
    portfolio: user.portfolio,
  }));
  type Field = keyof typeof values;
  const validation = profileSchema.safeParse({
    ...values,
    graduationYear: Number(values.graduationYear),
    skills: splitList(values.skills),
    interests: splitList(values.interests),
    domains: splitList(values.domains),
    lookingFor: splitList(values.lookingFor),
  });
  const errors: Partial<Record<Field, string>> = {};
  if (!validation.success)
    for (const issue of validation.error.issues) {
      const field = issue.path[0] as Field;
      if (!errors[field]) errors[field] = issue.message;
    }
  const visibleError = (field: Field) => (touched[field] || submitted ? errors[field] : undefined);
  const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }));
  const change = (field: Field, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  function fieldProps(field: Field) {
    return {
      id: `profile-${field}`,
      name: field,
      value: values[field],
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
      ) => change(field, event.target.value),
      onBlur: () => touch(field),
      'aria-invalid': Boolean(visibleError(field)),
      'aria-describedby': visibleError(field) ? `profile-${field}-error` : undefined,
    };
  }
  const fieldError = (field: Field) =>
    visibleError(field) ? (
      <span id={`profile-${field}-error`} className="error profile-field-error">
        {visibleError(field)}
      </span>
    ) : null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!validation.success || busy) return;
    setBusy(true);
    setError('');
    try {
      await save(validation.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save profile.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="profile-form" noValidate>
      <p className="muted">
        {user.onboarded
          ? 'Update your profile to help the right people find you.'
          : 'Complete your profile to find your circle.'}{' '}
        All fields marked required must be completed. Choose suggestions or add your own
        comma-separated values.
      </p>
      <div className="form-grid">
        <label>
          Full name (required)
          <input {...fieldProps('name')} required maxLength={80} />
          {fieldError('name')}
        </label>
        <label>
          College (required)
          <input {...fieldProps('college')} required maxLength={150} />
          {fieldError('college')}
        </label>
        <ProfileSelect
          name="degree"
          label="Degree / course"
          value={values.degree}
          options={degrees}
          maxLength={100}
          onChange={(value) => change('degree', value)}
          onBlur={() => touch('degree')}
          error={visibleError('degree')}
        />
        <label>
          Graduation year (required)
          <select {...fieldProps('graduationYear')} required>
            <option value="">Select graduation year</option>
            {values.graduationYear && !graduationYears.includes(Number(values.graduationYear)) && (
              <option value={values.graduationYear}>
                {values.graduationYear} (outside supported range)
              </option>
            )}
            {graduationYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          {fieldError('graduationYear')}
        </label>
        <ProfileSelect
          name="city"
          label="City"
          value={values.city}
          options={cities}
          maxLength={80}
          onChange={(value) => change('city', value)}
          onBlur={() => touch('city')}
          error={visibleError('city')}
        />
        <label>
          Profile photo URL (HTTPS, optional)
          <input {...fieldProps('photo')} type="url" maxLength={2048} />
          {fieldError('photo')}
        </label>
      </div>
      <label>
        Bio (required)
        <textarea
          {...fieldProps('bio')}
          required
          maxLength={1000}
          rows={3}
          placeholder="What are you excited to work on?"
        />
        {fieldError('bio')}
      </label>
      <div className="form-grid">
        {listFields.map((key) => (
          <fieldset key={key} className="profile-options">
            <legend>{labels[key]} (required)</legend>
            <label htmlFor={`profile-${key}`}>
              Selected or custom {labels[key].toLowerCase()} (comma-separated)
            </label>
            <input {...fieldProps(key)} required placeholder="Choose below or type your own" />
            {fieldError(key)}
            <div className="profile-option-list">
              {profileListOptions[key].map((option) => (
                <label key={option}>
                  <input
                    type="checkbox"
                    checked={splitList(values[key]).includes(option)}
                    onChange={(event) => {
                      const selected = event.target.checked;
                      setValues((current) => ({
                        ...current,
                        [key]: (selected
                          ? [...splitList(current[key]), option]
                          : splitList(current[key]).filter((value) => value !== option)
                        ).join(', '),
                      }));
                      touch(key);
                    }}
                  />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {(['linkedin', 'github', 'instagram', 'portfolio'] as const).map((key) => (
          <label key={key}>
            {key[0].toUpperCase() + key.slice(1)} (optional)
            <input {...fieldProps(key)} type="url" placeholder="https://" maxLength={2048} />
            {fieldError(key)}
          </label>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!validation.success && (
        <p className="muted" id="profile-validation-hint">
          Complete all required fields and fix any errors to save your profile.
        </p>
      )}
      <button
        className="button primary"
        disabled={busy || !validation.success}
        aria-describedby={!validation.success ? 'profile-validation-hint' : undefined}
      >
        {busy ? 'Saving…' : user.onboarded ? 'Save profile' : 'Find my circle'}
      </button>
    </form>
  );
}
export function ProfileDetails({ user }: { user: Student }) {
  return (
    <div className="profile-details">
      <Avatar user={user} size="large" />
      <h2>
        {user.name} <Verified user={user} />
      </h2>
      <p>
        {user.degree} · Class of {user.graduationYear}
      </p>
      <p className="muted">
        {user.college} · {user.city}
      </p>
      <p className="bio">{user.bio || 'This student is still writing their story.'}</p>
      {listFields.map((key) => (
        <section key={key}>
          <h4>{key === 'lookingFor' ? 'Looking for' : key[0].toUpperCase() + key.slice(1)}</h4>
          <div className="tags">
            {user[key].length ? (
              user[key].map((s) => <Tag key={s}>{s}</Tag>)
            ) : (
              <span className="muted">Not added yet</span>
            )}
          </div>
        </section>
      ))}
      <div className="profile-links">
        {(['linkedin', 'github', 'instagram', 'portfolio'] as const)
          .filter((key) => user[key])
          .map((key) => (
            <ExternalLink key={key} href={user[key]}>
              {key}
            </ExternalLink>
          ))}
      </div>
      <small className="muted">
        {user.collegeVerified
          ? 'College affiliation has been verified.'
          : 'College affiliation is self-reported. Email verification does not verify college enrollment.'}
      </small>
    </div>
  );
}
