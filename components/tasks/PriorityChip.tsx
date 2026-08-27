import { Chip, type ChipTone } from "@/components/ui/Chip";
import type { Priority } from "@/types/task";

const PRIORITY_TONE: Record<Priority, ChipTone> = {
  low: "low",
  medium: "medium",
  high: "high",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function PriorityChip({ priority }: { priority: Priority }) {
  return <Chip tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Chip>;
}
