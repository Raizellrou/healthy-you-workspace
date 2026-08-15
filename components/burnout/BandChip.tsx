import { Chip, type ChipTone } from "@/components/ui/Chip";
import type { BurnoutBand } from "@/types/burnout";

const BAND_TONE: Record<BurnoutBand, ChipTone> = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
};

const BAND_LABEL: Record<BurnoutBand, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function BandChip({ band }: { band: BurnoutBand }) {
  return <Chip tone={BAND_TONE[band]}>{BAND_LABEL[band]}</Chip>;
}
