export default function OwaspBadge({ value }: { value: string }) {
  const id = value.split(" ")[0];

  return (
    <span className="inline-flex rounded-full border border-cyan-500/40 bg-[#4ad7ff]/10 px-3 py-1 text-xs font-bold text-[#4ad7ff]">
      {id}
    </span>
  );
}
