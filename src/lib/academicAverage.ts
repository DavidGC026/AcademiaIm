type GradeSummary = { avg_grade: string | number | null; count_grade: string | number };

/** Mantiene la media de categorías existente; la ausencia de notas no es una calificación. */
export function calculateAcademicAverage(...summaries: GradeSummary[]): string | null {
  const averages = summaries
    .filter((summary) => Number(summary.count_grade) > 0 && summary.avg_grade !== null)
    .map((summary) => Number(summary.avg_grade))
    .filter(Number.isFinite);
  return averages.length ? (averages.reduce((sum, average) => sum + average, 0) / averages.length).toFixed(1) : null;
}
