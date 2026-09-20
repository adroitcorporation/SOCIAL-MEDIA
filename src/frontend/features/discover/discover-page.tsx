'use client';

import { useEffect, useState } from 'react';

import { ArrowRight, SlidersHorizontal, Search } from 'lucide-react';

import { useCircle } from '@/frontend/state/circle-context';
import { Empty } from '@/frontend/components/ui';

import { PageHeading } from '@/frontend/components/page-heading';
import { StudentCard } from '@/frontend/components/student-card';
export function DiscoverPage() {
  const { api, state, refresh, mutate, toast } = useCircle();
  const [filters, setFilters] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get('search') || '');
  }, []);
  async function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => {
      if (String(value).trim()) params.set(key, String(value).trim());
    });
    history.replaceState(null, '', `/discover?${params}`);
    try {
      await refresh();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  const page =
    typeof window !== 'undefined'
      ? Number(new URLSearchParams(location.search).get('page') || 0)
      : 0;
  return (
    <>
      <PageHeading
        eyebrow="PEOPLE MAKE THE DIFFERENCE"
        title="Find your kind of people."
        description="A future teammate, a fresh perspective, or a friend who just gets it."
      />
      <form className="filter-panel" onSubmit={apply}>
        <div className="filter-top">
          <div className="search-field">
            <Search size={18} />
            <input
              name="search"
              placeholder="Search by name, college, city, or a little curiosity…"
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
          <button className="button primary">Find people</button>
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
          <strong>{state.totalStudents}</strong> people to discover
        </span>
        <button
          className="text-link"
          onClick={async () => {
            try {
              await mutate(() => api.skips.clear());
              toast('Skipped profiles are back in your discovery feed.');
            } catch {}
          }}
        >
          Show skipped profiles
        </button>
      </div>
      <div className="student-grid discover-grid">
        {state.students.map((s) => (
          <StudentCard key={s.id} student={s} />
        ))}
      </div>
      {!state.students.length && (
        <Empty
          title="A wider circle is out there."
          body="Try a different skill, city, or college, or bring back your skipped profiles."
        />
      )}
      <div className="pagination">
        <button
          className="button secondary"
          disabled={page <= 0}
          onClick={async () => {
            const p = new URLSearchParams(location.search);
            p.set('page', String(page - 1));
            history.replaceState(null, '', `/discover?${p}`);
            await refresh();
          }}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className="button secondary"
          disabled={(page + 1) * 12 >= state.totalStudents}
          onClick={async () => {
            const p = new URLSearchParams(location.search);
            p.set('page', String(page + 1));
            history.replaceState(null, '', `/discover?${p}`);
            await refresh();
          }}
        >
          Next <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}
