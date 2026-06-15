import Link from "next/link";

const libraryCards = [
  {
    title: "Attack Scenarios",
    eyebrow: "SCENARIO LIBRARY",
    description:
      "Manage reusable red-team templates, OWASP mappings, and safe-behavior expectations.",
    href: "/library/scenarios",
    actionLabel: "Open Scenario Library",
  },
  {
    title: "Prompt Datasets",
    eyebrow: "DATASET LIBRARY",
    description:
      "Manage bulk prompt collections used for validation, campaigns, scoring, and reports.",
    href: "/library/datasets",
    actionLabel: "Open Dataset Library",
  },
];

export default function LibraryLandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#17191a]/95 p-7 shadow-[0_18px_42px_rgba(0,0,0,0.24)] sm:p-8 lg:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_8%,rgba(74,215,255,0.13),transparent_34%),radial-gradient(circle_at_92%_95%,rgba(255,52,52,0.16),transparent_34%)]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.28em] text-[#4ad7ff]">
            Library
          </p>

          <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-[-0.055em] text-white sm:text-5xl lg:text-6xl">
            AI Testing
            <span className="block text-[#ff3434]">Asset Library</span>
          </h1>

          <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[#d4d4d4] sm:text-base">
            Choose the testing asset type you want to manage.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {libraryCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group flex min-h-[260px] flex-col justify-between rounded-[22px] border border-white/[0.07] bg-[#1f2122]/95 p-6 shadow-[0_14px_30px_rgba(0,0,0,0.20)] transition hover:-translate-y-0.5 hover:border-[#4ad7ff]/40 hover:shadow-[0_0_28px_rgba(74,215,255,0.12)]"
          >
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
                {card.eyebrow}
              </p>

              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-white">
                {card.title}
              </h2>

              <p className="mt-4 max-w-xl text-sm leading-7 text-[#a9a9a9]">
                {card.description}
              </p>
            </div>

            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <span className="inline-flex rounded-[12px] border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-4 py-2 text-sm font-black text-white transition group-hover:border-[#4ad7ff]/45 group-hover:bg-[#4ad7ff]/16">
                {card.actionLabel}
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
