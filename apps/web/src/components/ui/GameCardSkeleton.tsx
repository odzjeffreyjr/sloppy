export function GameCardSkeleton() {
  return (
    <div className="bg-sloppy-surface rounded-wobbly-lg overflow-hidden border border-sloppy-border animate-pulse">
      <div className="aspect-video skeleton-shimmer" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 rounded skeleton-shimmer" />
        <div className="flex items-center gap-3">
          <div className="h-3 w-12 rounded skeleton-shimmer" />
          <div className="h-3 w-10 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export function GameCardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <GameCardSkeleton key={i} />
      ))}
    </div>
  );
}
