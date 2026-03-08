import { motion } from 'framer-motion';
import { useRef, useState, useCallback } from 'react';

interface SectionRowProps {
  title: string;
  children: React.ReactNode;
  onViewAll?: () => void;
}

export function SectionRow({ title, children, onViewAll }: SectionRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  return (
    <section className="space-y-3 min-w-0">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl text-sloppy-text">{title}</h2>
        {onViewAll && (
          <motion.button
            className="cursor-pointer text-sm text-sloppy-primary hover:text-sloppy-primary/80 font-medium transition-colors bg-transparent border-0"
            whileHover={{ x: 2 }}
            onClick={onViewAll}
          >
            View all &rarr;
          </motion.button>
        )}
      </div>

      <div className="relative group">
        {canScrollLeft && (
          <button
            className="cursor-pointer absolute left-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r from-sloppy-bg to-transparent opacity-0 group-hover:opacity-100 transition-opacity border-0 flex items-center justify-center"
            onClick={() => scroll('left')}
            aria-label="Scroll left"
          >
            <svg className="w-5 h-5 text-sloppy-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-none pb-1"
          onScroll={updateScrollState}
        >
          {children}
        </div>

        {canScrollRight && (
          <button
            className="cursor-pointer absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-sloppy-bg to-transparent opacity-0 group-hover:opacity-100 transition-opacity border-0 flex items-center justify-center"
            onClick={() => scroll('right')}
            aria-label="Scroll right"
          >
            <svg className="w-5 h-5 text-sloppy-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
