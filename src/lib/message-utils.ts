export type MessageType = "system" | "analysis" | "direct";

type ConversationInput = {
  fromId?: string | null;
  toId?: string | null;
  analysisId?: string | null;
};

export const getMessageType = ({ fromId, analysisId }: ConversationInput): MessageType => {
  if (fromId === "system") return "system";
  if (analysisId) return "analysis";
  return "direct";
};

export const buildConversationId = ({ fromId, toId, analysisId }: ConversationInput): string => {
  const from = String(fromId || "").trim();
  const to = String(toId || "").trim();
  if (!from || !to) {
    return analysisId ? `analysis:${analysisId}` : "";
  }
  const [a, b] = from < to ? [from, to] : [to, from];
  if (analysisId) {
    return `analysis:${analysisId}:${a}:${b}`;
  }
  return `direct:${a}:${b}`;
};
