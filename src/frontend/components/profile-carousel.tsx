'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

export function ProfileCarousel({ children }: { children: React.ReactNode }) {
  const tray = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ previous: false, next: false });
  useEffect(() => {
    const element = tray.current;
    if (!element) return;
    const update = () => {
      const previous = element.scrollLeft > 2;
      const next = element.scrollWidth - element.clientWidth - element.scrollLeft > 2;
      setRange((current) =>
        current.previous === previous && current.next === next ? current : { previous, next },
      );
    };
    const resize = new ResizeObserver(update);
    const observe = () => {
      resize.disconnect();
      resize.observe(element);
      [...element.children].forEach((child) => resize.observe(child));
      update();
    };
    const mutation = new MutationObserver(observe);
    mutation.observe(element, { childList: true });
    element.addEventListener('scroll', update, { passive: true });
    observe();
    return () => {
      resize.disconnect();
      mutation.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, []);
  const advance = (direction: number) => {
    const element = tray.current;
    if (!element) return;
    const first = element.firstElementChild as HTMLElement | null;
    const second = first?.nextElementSibling as HTMLElement | null;
    const step =
      first && second
        ? second.offsetLeft - first.offsetLeft
        : (first?.offsetWidth ?? element.clientWidth);
    element.scrollBy({
      left: direction * step,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };
  return (
    <>
      <div className="section-heading">
        <h2>People to meet</h2>
        <div className="profile-carousel-controls">
          {(range.previous || range.next) && (
            <>
              <button
                className="icon-button"
                aria-label="Previous profiles"
                aria-controls="home-profile-tray"
                disabled={!range.previous}
                onClick={() => advance(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Next profiles"
                aria-controls="home-profile-tray"
                disabled={!range.next}
                onClick={() => advance(1)}
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
          <Link href="/discover" className="text-link">
            View all <ArrowRight size={15} />
          </Link>
        </div>
      </div>
      <div
        ref={tray}
        id="home-profile-tray"
        className="horizontal-profile-tray"
        role="region"
        aria-label="People to meet"
        tabIndex={0}
      >
        {children}
      </div>
    </>
  );
}
