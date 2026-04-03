interface DailyGoalProps {
  dailyGoal: number;
  todaySessions: number;
}

export function DailyGoal({ dailyGoal, todaySessions }: DailyGoalProps) {
  const isDone = todaySessions >= dailyGoal;

  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-surface rounded-lg border border-stroke-subtle">
      <div className="flex gap-1.5">
        {Array.from({ length: dailyGoal }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              i < todaySessions ? 'bg-success-400 scale-110' : 'bg-stroke-subtle'
            }`}
          />
        ))}
      </div>
      <span className="text-sm text-prose-secondary">
        {isDone ? 'Daily goal completed! 🎯' : `${todaySessions}/${dailyGoal} passed`}
      </span>
    </div>
  );
}
