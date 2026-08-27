import { Input } from "@/components/ui/Input";

export function EstimateField({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (hours: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      max={500}
      step={0.5}
      placeholder="Hours"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
    />
  );
}
