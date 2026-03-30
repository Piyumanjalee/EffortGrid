import { BriefcaseBusiness, ExternalLink, GitBranch, Globe, UserCircle2 } from "lucide-react";

function Footer() {
  return (
    <footer className="relative z-10 mt-auto border-t border-white/20 bg-white/70 text-slate-700 shadow-xl backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-lg font-semibold text-slate-800">EffortGrid</p>
            <p className="text-sm text-slate-600">Built by Piyumanjalee Kavindi Senadheera</p>
            <p className="text-sm text-slate-600">Productivity and time tracking workspace</p>
          </div>

          <div className="space-y-2 text-sm">
            <a
              href="https://github.com/Piyumanjalee"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-slate-600 transition hover:text-blue-700"
            >
              <GitBranch size={16} />
              github.com/Piyumanjalee
            </a>
            <a
              href="https://www.linkedin.com/in/piyumanjalee-kavindi-senadheera-"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-slate-600 transition hover:text-blue-700"
            >
              <BriefcaseBusiness size={16} />
              linkedin.com/in/piyumanjalee-kavindi-senadheera-
            </a>
          </div>

          <a
            href="https://www.linkedin.com/in/piyumanjalee-kavindi-senadheera-"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 self-start rounded-md bg-blue-600 px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-blue-700"
          >
            Contact and Profile
            <ExternalLink size={14} />
          </a>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-white/20 py-4 text-sm text-slate-600 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Piyumanjalee"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="rounded-md border border-white/30 bg-white/60 p-2 transition hover:bg-white"
            >
              <GitBranch size={15} />
            </a>
            <a
              href="https://www.linkedin.com/in/piyumanjalee-kavindi-senadheera-"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="rounded-md border border-white/30 bg-white/60 p-2 transition hover:bg-white"
            >
              <BriefcaseBusiness size={15} />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <a href="/dashboard" className="border-b border-slate-300 pb-0.5 transition hover:text-blue-700">
              Home
            </a>
            <a href="/dashboard" className="border-b border-slate-300 pb-0.5 transition hover:text-blue-700">
              Time Tracking
            </a>
            <a href="/dashboard" className="border-b border-slate-300 pb-0.5 transition hover:text-blue-700">
              Todo List
            </a>
          </div>

          <p className="inline-flex items-center gap-1 text-xs text-slate-600">
            <UserCircle2 size={14} />
            <Globe size={14} />
            © 2026 EffortGrid | Built by Piyumanjalee
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
