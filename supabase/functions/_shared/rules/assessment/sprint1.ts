/** SERVER ONLY. Inject an authorized, immutable rubric; never accept a rubric from a browser. */
export interface RubricItem {
  item_id: string; objective_id: string; expected: string; options: readonly string[];
  explanation: string; transfer: boolean;
}
export interface Answer { item_id: string; value: string }
export function assess(items: readonly RubricItem[], answers: readonly Answer[]) {
  if (!items.length || new Set(items.map(i => i.item_id)).size !== items.length) throw new Error('INVALID_RUBRIC');
  if (new Set(answers.map(a => a.item_id)).size !== answers.length) throw new Error('DUPLICATE_ANSWER');
  if (answers.some(a => !items.some(i => i.item_id === a.item_id && i.options.includes(a.value)))) throw new Error('UNKNOWN_ANSWER');
  const feedback = items.map(item => {
    if (!item.options.includes(item.expected)) throw new Error('INVALID_RUBRIC');
    const answer = answers.find(a => a.item_id === item.item_id);
    const correct = answer?.value === item.expected;
    return { item_id: item.item_id, correct, message: `${correct ? 'Tepat.' : answer ? 'Coba tinjau kembali.' : 'Belum dijawab.'} ${item.explanation}` };
  });
  return { score: Math.round(100 * feedback.filter(f => f.correct).length / items.length), feedback,
    evidence: items.filter(i => answers.some(a => a.item_id === i.item_id)).map(item => ({
      objectiveId: item.objective_id, activityId: item.item_id,
      correct: feedback.find(f => f.item_id === item.item_id)!.correct,
      explanationVerified: feedback.find(f => f.item_id === item.item_id)!.correct,
      hintsUsed: 0, attemptCount: 1, transfer: item.transfer,
    })) };
}
