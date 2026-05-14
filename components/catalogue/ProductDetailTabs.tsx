'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EnrichedInfo } from '@/lib/products';

const tabs = [
  { id: 'description', label: 'Description' },
  { id: 'benefits', label: 'Benefits' },
  { id: 'howToUse', label: 'How to Use' },
  { id: 'ingredients', label: 'Ingredients' },
] as const;

type TabId = typeof tabs[number]['id'];

interface Props {
  description?: string;
  specification?: string;
  enrichedInfo?: EnrichedInfo;
}

export default function ProductDetailTabs({ description, specification, enrichedInfo }: Props) {
  const [active, setActive] = useState<TabId>('description');

  return (
    <div className="mt-12 border-t border-bone pt-8">
      <div className="flex gap-0 border-b border-bone mb-6 overflow-x-auto">
        {tabs.map(tab => {
          if (tab.id === 'benefits' && !enrichedInfo?.benefits?.length) return null;
          if (tab.id === 'howToUse' && !enrichedInfo?.protocol) return null;
          if (tab.id === 'ingredients' && !enrichedInfo?.ingredients) return null;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`px-5 py-3 text-xs font-semibold tracking-wider uppercase whitespace-nowrap transition-colors border-b-2 -mb-px ${
                active === tab.id
                  ? 'border-gold text-gold'
                  : 'border-transparent text-mist hover:text-charcoal'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-charcoal leading-relaxed"
        >
          {active === 'description' && (
            <div className="space-y-4">
              {description && <p>{description}</p>}
              {specification && (
                <p className="text-mist text-xs">{specification}</p>
              )}
            </div>
          )}

          {active === 'benefits' && enrichedInfo?.benefits && (
            <ul className="space-y-2">
              {enrichedInfo.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-gold mt-0.5">–</span>
                  <span>{b}</span>
                </li>
              ))}
              {enrichedInfo.treatmentAreas?.length && (
                <li className="mt-4 pt-4 border-t border-bone">
                  <span className="text-xs font-semibold tracking-wider uppercase text-mist">
                    Treatment Areas:
                  </span>{' '}
                  <span className="text-xs">{enrichedInfo.treatmentAreas.join(', ')}</span>
                </li>
              )}
              {enrichedInfo.duration && (
                <li>
                  <span className="text-xs font-semibold tracking-wider uppercase text-mist">
                    Duration:
                  </span>{' '}
                  <span className="text-xs">{enrichedInfo.duration}</span>
                </li>
              )}
            </ul>
          )}

          {active === 'howToUse' && enrichedInfo?.protocol && (
            <p>{enrichedInfo.protocol}</p>
          )}

          {active === 'ingredients' && enrichedInfo?.ingredients && (
            <p>{enrichedInfo.ingredients}</p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
