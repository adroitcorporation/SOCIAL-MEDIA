'use client';
import { roleLabels } from '@/shared/contracts/permissions';
import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { Student } from '@/shared/contracts/responses';
import type { ProfileUpdateRequest } from '@/shared/contracts/requests';
import { Avatar, Verified, Tag, ExternalLink } from '@/frontend/components/ui';
import { authClient } from '@/frontend/auth/supabase-browser';
import { profileSchemaForExisting, safeUrl } from '@/shared/contracts/schemas';
import { MIN_CONNECTION_BIO_LENGTH } from '@/shared/contracts/profile-completion';
import {
  MAX_VERIFICATION_IMAGE_BYTES,
  VERIFICATION_IMAGE_TYPES,
} from '@/shared/contracts/verification';
import { cities, degrees, graduationYears, profileListOptions } from './profile-options';
import { ProfileSelect } from './profile-select';
import { TaxonomySelect } from './taxonomy-select';
import { CollegeSelect } from './college-select';
type Save = (body: ProfileUpdateRequest) => Promise<void>;
const profilePhotoBucket = 'profile-photos';
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
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const uploadInFlight = useRef(false);
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
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
  const validation = profileSchemaForExisting(user).safeParse({
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
  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (busy || uploadInFlight.current) return;
    setPhotoError('');
    if (
      !VERIFICATION_IMAGE_TYPES.includes(file.type as (typeof VERIFICATION_IMAGE_TYPES)[number]) ||
      !file.size ||
      file.size > MAX_VERIFICATION_IMAGE_BYTES
    ) {
      setPhotoError('Choose a JPG, PNG, or WebP image up to 4 MB.');
      return;
    }
    uploadInFlight.current = true;
    setPhotoUploading(true);
    setPhotoPreview(URL.createObjectURL(file));
    try {
      const supabase = authClient();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session || data.session.user.id !== user.id)
        throw new Error('Sign in to your account before uploading a profile photo.');
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.slice('image/'.length);
      const path = `${data.session.user.id}/${crypto.randomUUID()}.${extension}`;
      const storage = supabase.storage.from(profilePhotoBucket);
      const { data: uploaded, error: uploadError } = await storage.upload(path, file, {
        cacheControl: '31536000',
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const publicUrl = safeUrl.parse(storage.getPublicUrl(uploaded.path).data.publicUrl);
      change('photo', publicUrl);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : 'Unable to upload this photo. Please try again.';
      setPhotoError(
        /bucket not found/i.test(message)
          ? 'Profile photo storage is not set up. Run supabase/profile-photos.sql in the Supabase project configured for this app.'
          : message,
      );
    } finally {
      uploadInFlight.current = false;
      setPhotoPreview('');
      setPhotoUploading(false);
    }
  }
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
    if (!validation.success || busy || uploadInFlight.current) return;
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
      <div className="form-grid">
        <label>
          Full name (required)
          <input {...fieldProps('name')} required maxLength={80} />
          {fieldError('name')}
        </label>
        <CollegeSelect
          value={values.college}
          onChange={(value) => change('college', value)}
          onBlur={() => touch('college')}
          error={visibleError('college')}
        />
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
        <div className="profile-photo-field">
          <span className="profile-photo-label">Profile photo (optional)</span>
          <div className="profile-photo-control">
            <Avatar
              key={photoPreview || values.photo}
              user={{ name: values.name || user.name, photo: photoPreview || values.photo }}
              size="large"
            />
            <div className="profile-photo-actions">
              <input
                ref={photoInput}
                id="profile-photo-upload"
                className="profile-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Choose profile photo file"
                onChange={uploadPhoto}
                disabled={busy || photoUploading}
              />
              <button
                type="button"
                className="button secondary small"
                disabled={busy || photoUploading}
                onClick={() => photoInput.current?.click()}
              >
                <Upload size={15} />
                {photoUploading ? 'Uploading…' : values.photo ? 'Change photo' : 'Upload photo'}
              </button>
              {values.photo && (
                <button
                  type="button"
                  className="text-link danger"
                  disabled={busy || photoUploading}
                  onClick={() => change('photo', '')}
                >
                  Remove photo
                </button>
              )}
              <small>JPG, PNG, or WebP · Up to 4 MB</small>
            </div>
          </div>
          {photoError && (
            <span className="error profile-field-error" role="alert">
              {photoError}
            </span>
          )}
          {fieldError('photo')}
        </div>
      </div>
      <label>
        Bio (required)
        <textarea
          {...fieldProps('bio')}
          required
          maxLength={1000}
          rows={3}
          placeholder="What are you excited to work on?"
          aria-describedby="connection-bio-hint"
        />
        {fieldError('bio')}
      </label>
      <small id="connection-bio-hint" className="muted">
        Use at least {MIN_CONNECTION_BIO_LENGTH} characters to tell students about yourself before
        connecting.
      </small>
      <div className="form-grid">
        {listFields.map((key) =>
          key !== 'domains' ? (
            <TaxonomySelect
              key={key}
              field={key}
              label={labels[key]}
              values={splitList(values[key])}
              onChange={(values) => {
                change(key, values.join(', '));
                touch(key);
              }}
              error={visibleError(key)}
            />
          ) : (
            <fieldset key={key} className="profile-options">
              <legend>{labels[key]} (required)</legend>
              <label htmlFor={`profile-${key}`}>Custom values (comma-separated)</label>
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
          ),
        )}
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
        disabled={busy || photoUploading || !validation.success}
        aria-describedby={!validation.success ? 'profile-validation-hint' : undefined}
      >
        {busy ? 'Saving…' : user.onboarded ? 'Save' : 'Continue'}
      </button>
    </form>
  );
}
export function ProfileDetails({ user, compact = false }: { user: Student; compact?: boolean }) {
  return (
    <div className="profile-details">
      {!compact && (
        <>
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
        </>
      )}
      {(user.role !== 'STUDENT' || user.accountStatus !== 'ACTIVE') && (
        <p>
          {user.role !== 'STUDENT' && <span className="tag">{roleLabels[user.role]}</span>}
          {user.accountStatus !== 'ACTIVE' && <span className="tag">{user.accountStatus}</span>}
        </p>
      )}
      {user.bio && <p className="bio">{user.bio}</p>}
      {listFields.map((key) => (
        <section key={key}>
          <h4>{key === 'lookingFor' ? 'Looking for' : key[0].toUpperCase() + key.slice(1)}</h4>
          <div className={`tags profile-group-${key}`}>
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
