import { Skeleton } from "@/components/ui/panel";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="border-b border-line bg-container px-4 py-6 sm:px-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-8 w-72" />
      </div>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-md" />
      </div>
    </div>
  );
}
