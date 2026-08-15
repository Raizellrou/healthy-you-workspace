const BLUSH = "rgba(244, 63, 94, 0.35)";

export function AxolotlFace({ value, line }: { value: 1 | 2 | 3 | 4 | 5; line: string }) {
  switch (value) {
    case 1: // Awful — closed sad eyes, frown
      return (
        <g stroke={line} strokeWidth={1.1} strokeLinecap="round" fill="none">
          <path d="M10.5 12 13 13.5 M10.5 15 13 13.5" />
          <path d="M21.5 12 19 13.5 M21.5 15 19 13.5" />
          <path d="M12 17Q16 14 20 17" />
        </g>
      );
    case 2: // Low — tired half-lidded eyes, flat downturned mouth
      return (
        <g stroke={line} strokeWidth={1.1} strokeLinecap="round" fill="none">
          <path d="M10.5 13.5h3" />
          <path d="M18.5 13.5h3" />
          <path d="M12.5 17Q16 16.3 19.5 17" />
        </g>
      );
    case 3: // Okay — dot eyes, flat mouth
      return (
        <g fill={line}>
          <circle cx={12} cy={13} r={1} />
          <circle cx={20} cy={13} r={1} />
          <path
            d="M12.5 17h7"
            stroke={line}
            strokeWidth={1.1}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
    case 4: // Good — soft dot eyes, gentle smile, light blush
      return (
        <g>
          <circle cx={9} cy={15.5} r={1.6} fill={BLUSH} />
          <circle cx={23} cy={15.5} r={1.6} fill={BLUSH} />
          <circle cx={12} cy={13} r={1.1} fill={line} />
          <circle cx={20} cy={13} r={1.1} fill={line} />
          <path
            d="M12 16.5Q16 18.5 20 16.5"
            stroke={line}
            strokeWidth={1.2}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
    case 5: // Great — happy closed eyes, big smile, blush
      return (
        <g>
          <circle cx={8.5} cy={15.5} r={1.9} fill={BLUSH} />
          <circle cx={23.5} cy={15.5} r={1.9} fill={BLUSH} />
          <g stroke={line} strokeWidth={1.2} strokeLinecap="round" fill="none">
            <path d="M10 14Q12 11.5 14 14" />
            <path d="M18 14Q20 11.5 22 14" />
            <path d="M11 16Q16 20.5 21 16" />
          </g>
        </g>
      );
  }
}
