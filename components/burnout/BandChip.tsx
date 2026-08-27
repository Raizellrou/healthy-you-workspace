import { Chip, type ChipTone } from "@/components/ui/Chip";
import { BAND_LABEL } from "@/lib/burnout-bands";
import type { BurnoutBand } from "@/types/burnout";

const BAND_TONE: Record<BurnoutBand, ChipTone> = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
};

export function BandChip({ band }: { band: BurnoutBand }) {
  return <Chip tone={BAND_TONE[band]}>{BAND_LABEL[band]}</Chip>;
}
