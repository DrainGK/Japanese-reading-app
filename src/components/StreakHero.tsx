import { getMilestone, getNextMilestone } from '../lib/streaks';

interface StreakHeroProps {
  streak: number;
  hasReadToday: boolean;
}

export function StreakHero({ streak, hasReadToday }: StreakHeroProps) {
  const milestone = getMilestone(streak);
  const nextMilestone = getNextMilestone(streak);

  return (
    <div className="bg-warning-50 border border-warning-100 rounded-xl p-6 text-center animate-fade-up">
      <span className="text-5xl font-semibold text-warning-500 animate-pop block mb-3">
        {streak}
      </span>
      <p className="text-sm font-medium text-warning-600">
        {streak === 1 ? 'day streak' : 'days streak'} 🔥
      </p>

      {milestone && (
        <div className="mt-3 inline-block bg-warning-100 text-warning-700 text-xs font-medium px-3 py-1 rounded-full">
          ✨ {milestone}
        </div>
      )}

      {nextMilestone && !milestone && (
        <p className="text-xs text-warning-600 mt-3">
          {nextMilestone.target - streak} days to milestone: {nextMilestone.label}
        </p>
      )}

      {!hasReadToday && streak > 0 && (
        <p className="text-xs text-warning-500 mt-4 animate-pulse-soft">
          Keep the streak alive today! 📖
        </p>
      )}
    </div>
  );
}
