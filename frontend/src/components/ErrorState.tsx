export default function ErrorState({
  title = "Something went wrong",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="rounded-[23px] border border-red-400/25 bg-[#ff3434]/10 p-6 text-red-100 shadow-[0_18px_45px_rgba(255,52,52,0.08)]">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[18px] border border-[#ff3434]/30 bg-[#ff3434]/15 text-lg font-black text-[#ff3434]">
          !
        </div>

        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-[#ff3434]">
            Error State
          </p>
          <h3 className="mt-2 text-lg font-black text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-red-100/85">{message}</p>
        </div>
      </div>
    </div>
  );
}
