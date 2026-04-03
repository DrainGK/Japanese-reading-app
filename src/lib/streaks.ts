// Milestone definitions for streak achievements
export const MILESTONES: Record<number, string> = {
  3: '3 days 🌱',
  7: 'One week 🗓',
  14: 'Two weeks 💪',
  30: 'One month 🏅',
  60: 'Two months ⚡',
  100: '100 days 🔱',
};

export function getMilestone(streak: number): string | null {
  return MILESTONES[streak] ?? null;
}

export function getNextMilestone(streak: number): { target: number; label: string } | null {
  const milestones = Object.entries(MILESTONES)
    .map(([key, value]) => ({ target: parseInt(key), label: value }))
    .sort((a, b) => a.target - b.target);

  for (const milestone of milestones) {
    if (streak < milestone.target) {
      return milestone;
    }
  }

  return null;
}

export function isToday(date: Date | number): boolean {
  const today = new Date();
  const checkDate = date instanceof Date ? date : new Date(date);
  
  return (
    checkDate.getFullYear() === today.getFullYear() &&
    checkDate.getMonth() === today.getMonth() &&
    checkDate.getDate() === today.getDate()
  );
}
