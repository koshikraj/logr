"use client";

// The logr agent avatar (design: Logr Agent Avatar Concepts.dc.html) —
// coral head with scanning eyes over an ink body dot. One component, many
// states; styles in src/app/agent.css (self-contained, themes via CSS vars).

export type AgentState =
  | "idle" // bob + look + blink
  | "working" // orbit ring + fast eye scan (loaders)
  | "reading" // eyes tracking a scan (ingest states)
  | "notes" // writing the log line by line on a notepad
  | "typing" // paired with a speech-bubble dots adornment
  | "explaining" // leaning toward whatever it points at
  | "success" // hop, happy closed eyes, confetti
  | "confused" // head tilt + floating question mark
  | "sleeping"; // flat eyes + drifting z's

export function AgentAvatar({
  state = "idle",
  size = 32,
  entrance = false,
  className,
}: {
  state?: AgentState;
  /** head diameter in px — body/eyes/adornments scale from it */
  size?: number;
  /** play the drop-bounce entry animation on mount */
  entrance?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`agv agv--${state}${entrance ? " agv--enter" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--agv-head": `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      {state === "confused" && <span className="agv__q">?</span>}
      {state === "sleeping" && (
        <span className="agv__zs">
          <span>z</span>
          <span>z</span>
          <span>z</span>
        </span>
      )}
      {state === "success" && (
        <span className="agv__confetti">
          <span /><span /><span /><span /><span />
        </span>
      )}
      <span className="agv__pose">
        {state === "working" && (
          <span className="agv__orbit"><span /></span>
        )}
        {state === "reading" && (
          <span className="agv__doc">
            <span /><span /><span /><span />
            <span className="agv__sweep" />
          </span>
        )}
        <span className="agv__mark">
          <span className="agv__head">
            <span className="agv__eyes"><span /><span /></span>
          </span>
          <span className="agv__body" />
        </span>
        {state === "notes" && (
          <span className="agv__pad">
            <span /><span /><span /><span />
            <span className="agv__pencil" />
          </span>
        )}
        {state === "explaining" && <span className="agv__point">▸</span>}
      </span>
    </span>
  );
}
