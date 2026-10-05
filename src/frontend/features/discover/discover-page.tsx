'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { SlidersHorizontal, Search, ArrowRight } from 'lucide-react';

import { useCircle } from '@/frontend/state/circle-context';
import { Empty } from '@/frontend/components/ui';

import { PageHeading } from '@/frontend/components/page-heading';
import { StudentCard } from '@/frontend/components/student-card';
export function DiscoverPage() {
  const queryKey = useSearchParams().toString();
  return <DiscoverFeed key={queryKey} queryKey={queryKey} />;
}

function DiscoverFeed({ queryKey }: { queryKey: string }) {
  const { api, state, navigate, mutate, toast } = useCircle();
  const [filters, setFilters] = useState(false);
  const [search, setSearch] = useState(() => new URLSearchParams(queryKey).get('search') || '');
  const [actedStudentIds, setActedStudentIds] = useState<Set<string>>(() => new Set());
  async function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => {
      if (String(value).trim()) params.set(key, String(value).trim());
    });
    navigate(`/discover?${params}`);
  }
  const visibleStudent = useMemo(
    () => state.students.find((student) => !actedStudentIds.has(student.id)) || null,
    [actedStudentIds, state.students],
  );
  const finishedQueue =
    actedStudentIds.size > 0 && state.students.every((student) => actedStudentIds.has(student.id));
  return (
    <div className="discover-page">
      <PageHeading title="Discover people" />
      <form className="filter-panel" onSubmit={apply}>
        <div className="filter-top">
          <div className="search-field">
            <Search size={18} />
            <input
              name="search"
              aria-label="Search people"
              placeholder="Name, college, city"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={`button ${filters ? 'primary' : 'secondary'}`}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
          <button
            className="button primary discover-submit"
            aria-label="Search profiles"
            title="Search profiles"
          >
            <ArrowRight size={17} />
          </button>
        </div>
        <div className={`filter-fields ${filters ? 'expanded' : ''}`}>
          {[
            ['college', 'College'],
            ['city', 'City'],
            ['skills', 'Skill (e.g. React)'],
            ['domains', 'Domain'],
            ['interests', 'Interest'],
            ['lookingFor', 'Looking for'],
            ['graduationYear', 'Graduation year'],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                placeholder={label}
                type={key === 'graduationYear' ? 'number' : 'text'}
                min={key === 'graduationYear' ? 2020 : undefined}
                max={key === 'graduationYear' ? 2040 : undefined}
              />
            </label>
          ))}
        </div>
      </form>
      <div className="results-bar">
        <span>
          <strong>{state.totalStudents}</strong> profiles
        </span>
        <button
          className="text-link"
          onClick={async () => {
            try {
              await mutate(() => api.skips.clear());
              toast('Skipped profiles restored.');
            } catch {}
          }}
        >
          Show skipped profiles
        </button>
      </div>
      <div className="discover-single">
        {visibleStudent ? (
          <StudentCard
            key={visibleStudent.id}
            student={visibleStudent}
            discoverMode
            onAfterAction={(studentId) =>
              setActedStudentIds((acted) => new Set(acted).add(studentId))
            }
          />
        ) : (
          <Empty
            title={finishedQueue ? "You're all caught up." : 'No people found.'}
            body={
              finishedQueue
                ? 'Check back for more people.'
                : 'Try other filters or show skipped profiles.'
            }
          />
        )}
      </div>
    </div>
  );
}
