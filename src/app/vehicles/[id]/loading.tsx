export default function Loading() {
  return (
    <div className="container-nw pt-6 md:pt-10">
      <div className="skeleton h-4 w-24" />
      <div className="mt-5 grid gap-3 md:grid-cols-[2fr_1fr]">
        <div className="skeleton h-[300px] rounded-3xl md:h-[460px]" />
        <div className="hidden grid-cols-2 gap-3 sm:grid md:grid-cols-1">
          <div className="skeleton h-[220px] rounded-3xl" />
          <div className="skeleton h-[220px] rounded-3xl" />
        </div>
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <div className="skeleton h-8 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
          </div>
        </div>
        <div className="skeleton h-[280px] rounded-2xl" />
      </div>
    </div>
  );
}
