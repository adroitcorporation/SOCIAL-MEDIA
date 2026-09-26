'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useFeedFilters(allCategory: string) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const urlSearch = params.get('search') || '';
  const [search, setSearch] = useState(urlSearch);
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => {
    if (search === urlSearch) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(query);
      if (search) next.set('search', search);
      else next.delete('search');
      next.delete('page');
      router.replace(`${path}?${next}`, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, urlSearch, query, path, router]);
  function filter(key: string, value: string) {
    const next = new URLSearchParams(query);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    router.replace(`${path}?${next}`, { scroll: false });
  }
  return {
    search,
    setSearch,
    category: params.get('category') || allCategory,
    setCategory: (value: string) => filter('category', value === allCategory ? '' : value),
    only: params.get('only') === 'true',
    setOnly: (value: boolean) => filter('only', value ? 'true' : ''),
    setPage: (page: number) => filter('page', String(page)),
  };
}
