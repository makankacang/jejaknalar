import type { StoryPlan, StoryDialogue } from './adapter';

export type StoryProgress = {
  completedActivityIds: string[];
  unlockedMissionIds: string[];
  activeDialogue: { npcId: string; nodeId: string } | null;
};
export const initialStoryProgress = (): StoryProgress => ({
  completedActivityIds: [], unlockedMissionIds: [], activeDialogue: null,
});
export function activeStoryObjective(plan: StoryPlan, progress: StoryProgress) {
  return plan.objectives.find(o =>
    !o.activityIds.every(id => progress.completedActivityIds.includes(id))
  ) ?? null;
}
export function completeStoryInteraction(
  plan: StoryPlan, progress: StoryProgress, roomId: string, objectId: string,
): StoryProgress {
  const objective = activeStoryObjective(plan, progress);
  if (!objective || objective.room !== roomId) return progress;
  const task = plan.tasks.find(t =>
    t.room_id === roomId && t.object_id === objectId &&
    objective.activityIds.includes(t.activity_id) &&
    !progress.completedActivityIds.includes(t.activity_id)
  );
  if (!task) return progress;
  return { ...progress, completedActivityIds: [...progress.completedActivityIds, task.activity_id] };
}
export function openStoryDialogue(
  plan: StoryPlan, progress: StoryProgress, npcId: string, roomId: string,
): StoryProgress {
  const dialogue = plan.dialogues.find(d => d.npc_id === npcId && d.room_id === roomId);
  return dialogue ? { ...progress, activeDialogue: { npcId, nodeId: dialogue.start_node_id } } : progress;
}
export function currentStoryDialogue(plan: StoryPlan, progress: StoryProgress):
  { dialogue: StoryDialogue; node: StoryDialogue['nodes'][number] } | null {
  const active = progress.activeDialogue;
  if (!active) return null;
  const dialogue = plan.dialogues.find(d => d.npc_id === active.npcId);
  const node = dialogue?.nodes.find(n => n.node_id === active.nodeId);
  return dialogue && node ? { dialogue, node } : null;
}
export function chooseStoryDialogue(
  plan: StoryPlan, progress: StoryProgress, choiceId: string,
): StoryProgress {
  const current = currentStoryDialogue(plan, progress);
  const choice = current?.node.choices.find(c => c.choice_id === choiceId);
  if (!choice) return progress;
  return {
    ...progress,
    unlockedMissionIds: choice.unlock_mission_id
      ? [...new Set([...progress.unlockedMissionIds, choice.unlock_mission_id])]
      : progress.unlockedMissionIds,
    activeDialogue: choice.next_node_id
      ? { npcId: current!.dialogue.npc_id, nodeId: choice.next_node_id }
      : null,
  };
}
export function closeStoryDialogue(progress: StoryProgress): StoryProgress {
  return { ...progress, activeDialogue: null };
}
