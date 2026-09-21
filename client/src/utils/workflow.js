// Mirror of the server's status workflow, used ONLY to give the Kanban board instant visual
// feedback (which columns look droppable). The server is the authority and re-validates every move.
export function canDropTo(issue, target) {
  return Boolean(issue?.capabilities?.allowedTransitions?.includes(target));
}
