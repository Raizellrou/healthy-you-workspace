const ICON_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconSprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute", overflow: "hidden" }}
      aria-hidden="true"
    >
      <defs>
        <symbol id="i-grid" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </g>
        </symbol>

        <symbol id="i-users" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" />
            <circle cx="17" cy="9" r="2.4" />
            <path d="M15.8 14.2c2.4.3 4.2 2.5 4.2 5.3" />
          </g>
        </symbol>

        <symbol id="i-calendar" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18" />
            <path d="M8 3v4M16 3v4" />
          </g>
        </symbol>

        <symbol id="i-activity" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <path d="M2 13h4l2.5-7 4 14 2.5-9 2 2h5" />
          </g>
        </symbol>

        <symbol id="i-bell" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14.5 6 10.5Z" />
            <path d="M10 19a2 2 0 0 0 4 0" />
          </g>
        </symbol>

        <symbol id="i-smile" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 10.5h.01M15.5 10.5h.01" />
            <path d="M8 14.5c1 1.5 2.5 2.3 4 2.3s3-.8 4-2.3" />
          </g>
        </symbol>

        <symbol id="i-shield" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <path d="M12 3l7 3v6c0 4.6-3 7.7-7 9-4-1.3-7-4.4-7-9V6l7-3Z" />
          </g>
        </symbol>

        <symbol id="i-coffee" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <path d="M5 9h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z" />
            <path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17" />
            <path d="M8 3.5c-.6.7-.6 1.3 0 2M12 3.5c-.6.7-.6 1.3 0 2" />
          </g>
        </symbol>

        <symbol id="i-timer" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <circle cx="12" cy="13" r="8" />
            <path d="M12 13V9M9.5 3.5h5" />
          </g>
        </symbol>

        <symbol id="i-stretch" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <circle cx="12" cy="4.5" r="2" />
            <path d="M12 8v7M12 8 6 5M12 8l6-3M12 15l-4 6M12 15l4 6" />
          </g>
        </symbol>

        <symbol id="i-droplet" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <path d="M12 3s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11Z" />
          </g>
        </symbol>

        <symbol id="i-eye" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z" />
            <circle cx="12" cy="12" r="2.6" />
          </g>
        </symbol>

        <symbol id="i-posture" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <circle cx="13" cy="4.5" r="2" />
            <path d="M13 8v5l4 3M13 13l-4 2M9 20l4-4" />
          </g>
        </symbol>

        <symbol id="i-check" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <path d="M4 12.5l5 5L20 6" />
          </g>
        </symbol>

        <symbol id="i-lock" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <rect x="4.5" y="11" width="15" height="10" rx="2" />
            <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
          </g>
        </symbol>

        <symbol id="i-focus" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
          </g>
        </symbol>

        <symbol id="i-x" viewBox="0 0 24 24">
          <g {...ICON_PROPS}>
            <path d="M5 5l14 14M19 5 5 19" />
          </g>
        </symbol>
      </defs>
    </svg>
  );
}
