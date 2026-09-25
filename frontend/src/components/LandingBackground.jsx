// A quiet, theme-colored background. CSS keeps motion independent of scrolling.
export default function LandingBackground() {
  return (
    <div className="landing-background" aria-hidden="true">
      <svg viewBox="0 0 1440 1000" preserveAspectRatio="none" focusable="false">
        <g className="landing-background-lines">
          <path d="M-220 750C180 790 10 160 450-100" />
          <path d="M-180 800C220 840 50 210 490-50" />
          <path d="M-140 850C260 890 90 260 530 0" />
        </g>
        <g className="landing-background-lines landing-background-lines-secondary">
          <path d="M1030-140C760 220 1500 290 1340 1140" />
          <path d="M1080-140C810 220 1550 290 1390 1140" />
          <path d="M1130-140C860 220 1600 290 1440 1140" />
        </g>
      </svg>
    </div>
  );
}
