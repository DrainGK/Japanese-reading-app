interface StatsRowProps {
  streak: number;
  sessions: number;
  avgScore: number;
  hasReadToday: boolean;
}

export function StatsRow({ streak, sessions, avgScore, hasReadToday }: StatsRowProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Streak Card */}
      <div className="card">
        <div className="text-3xl font-semibold text-warning-500">{streak}</div>
        <p className="text-prose-secondary text-sm mt-1">
          {streak === 1 ? 'Day Streak' : 'Day Streak'} 🔥
        </p>
        {!hasReadToday && (
          <p className="text-2xs text-warning-500 mt-2 animate-pulse-soft mt-3">
            Read today to keep going
          </p>
        )}
      </div>

      {/* Sessions Card */}
      <div className="card">
        <div className="text-3xl font-semibold text-success-500">{sessions}</div>
        <p className="text-prose-secondary text-sm mt-1">Sessions</p>
      </div>

      {/* Average Score Card */}
      <div className="card">
        <div className="text-3xl font-semibold text-primary-400">
          {avgScore.toFixed(0)}%
        </div>
        <p className="text-prose-secondary text-sm mt-1">Avg Score</p>
      </div>
    </div>
  );
}
