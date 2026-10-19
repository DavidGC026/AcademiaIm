export interface AssistantAction {
  id: string;
  label: string;
  href: string;
}

/** Convierte IDs del modelo en rutas creadas por el servidor; nunca acepta URLs generadas. */
export function resolveAssistantActions(
  actionIds: string[],
  catalogActions: AssistantAction[]
): AssistantAction[] {
  const catalog = new Map(catalogActions.map((action) => [action.id, action]));
  return [...new Set(actionIds)]
    .map((actionId) => catalog.get(actionId))
    .filter((action): action is AssistantAction => Boolean(action))
    .slice(0, 3);
}
