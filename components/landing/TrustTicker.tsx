import React from 'react';
import { Award, Building2 } from 'lucide-react';
import { PARTNER_LOGOS } from './landingContent';

// Trust band. Names are set as text with a generic icon rather than as
// hotlinked brand logos — see landingContent.ts on what this content is.
const TrustTicker: React.FC = () => {
  return (
    <section className="py-10 bg-slate-900 dark:bg-ink-900 text-white border-y border-slate-800 dark:border-ink-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400">
              <Award className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Được tin dùng bởi nhân sự tại
              </p>
              <p className="text-sm font-semibold text-slate-200">
                Các tập đoàn &amp; công ty công nghệ hàng đầu
              </p>
            </div>
          </div>

          <ul className="flex flex-wrap items-center justify-center md:justify-end gap-x-8 gap-y-4">
            {PARTNER_LOGOS.map((partner) => (
              <li key={partner.name} className="flex items-center gap-2 group">
                <Building2
                  className="w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors"
                  aria-hidden="true"
                />
                <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                  {partner.name}
                </span>
                <span className="hidden lg:inline-block text-[10px] px-2 py-0.5 rounded bg-slate-800 dark:bg-ink-800 text-slate-400">
                  {partner.sector}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default TrustTicker;
