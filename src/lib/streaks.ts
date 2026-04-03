// Milestone definitions for streak achievements
export const MILESTONES: Record<number, string> = {
  3: "3 jours 🌱",
  7: "Une semaine 🗓",
  14: "Deux semaines 💪",
  30: "Un mois 🏅",
  60: "Deux mois ⚡",
  100: "100 jours 🔱",
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
