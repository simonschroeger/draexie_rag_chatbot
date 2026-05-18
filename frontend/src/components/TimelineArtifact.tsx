import React from 'react';
import { Milestone } from '../types';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface TimelineProps {
  data: {
    title: string;
    status: string;
    milestones: Milestone[];
  };
}

export const TimelineArtifact: React.FC<TimelineProps> = ({ data }) => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="mb-6 pb-4 border-b border-outline-variant flex justify-between items-end">
        <div>
          <h3 className="text-xl font-bold text-on-surface">{data.title}</h3>
          <p className="text-xs text-on-surface-variant uppercase tracking-wider mt-1 font-mono">
            Projected Timeline
          </p>
        </div>
        <span className="px-2 py-1 bg-primary-container/20 text-primary-container text-xs font-semibold rounded border border-primary-container/30">
          {data.status}
        </span>
      </div>

      <div className="relative pl-8 space-y-8 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {/* Animated Line */}
        <div className="absolute left-2 top-2 bottom-2 w-px bg-outline-variant" />

        {data.milestones.map((milestone, idx) => {
          const isCompleted = milestone.status === 'completed';
          const isInProgress = milestone.status === 'in-progress';

          return (
            <motion.div
              key={milestone.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative ${!isCompleted && !isInProgress ? 'opacity-50' : ''}`}
            >
              {/* Dot */}
              <div className="absolute -left-[31px] mt-1.5 w-4 h-4 bg-surface-container-low border-2 border-outline-variant rounded-full flex items-center justify-center z-10">
                {isCompleted ? (
                  <div className="w-full h-full bg-primary-container rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                ) : isInProgress ? (
                  <div className="w-2 h-2 bg-primary-container rounded-full animate-pulse shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
                ) : (
                  <div className="w-1.5 h-1.5 bg-outline-variant rounded-full" />
                )}
              </div>

              <div className={`p-4 rounded-xl border transition-all duration-300 ${
                isInProgress 
                  ? 'bg-surface-container-highest border-primary-container/40 shadow-lg' 
                  : 'bg-surface-container border-outline-variant'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className={`text-sm font-semibold ${isInProgress ? 'text-primary-container' : 'text-on-surface'}`}>
                    {milestone.title}
                  </h4>
                  <span className="font-mono text-[10px] text-on-surface-variant flex items-center gap-1">
                    <Clock size={10} />
                    {milestone.date}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {milestone.description}
                </p>
                
                {milestone.risk_level && (
                  <div className="mt-3 flex gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 border ${
                      milestone.risk_level === 'high' 
                        ? 'bg-red-500/10 text-red-400 border-red-500/30' 
                        : milestone.risk_level === 'medium'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}>
                      <AlertCircle size={8} />
                      Risk: {milestone.risk_level}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
