"use client";
import { type RefObject } from "react";
import { Button } from "./ui";
import { recordingTimestamp as clock } from "../lib/evidence-clip";

export function EvidenceNavigation({ transcriptRef, segments, total, transcript, current, onLocate }: {
  transcriptRef: RefObject<HTMLDivElement | null>;
  segments: number[];
  total: number;
  transcript: { at: number }[];
  current?: number;
  onLocate: (index: number) => void;
}) {
  const currentIndex = Math.max(0, segments.indexOf(current ?? -1));
  const locate = (direction: -1 | 0 | 1) => {
    if (!segments.length) return;
    const segment = segments[(currentIndex + direction + segments.length) % segments.length];
    onLocate(segment);
    const row = transcriptRef.current?.children[segment] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
    row?.focus({ preventScroll: true });
  };
  return <div className="evidence-transcript-heading">
    <div><h3>通话转写</h3><span>· {total}段</span></div>
    {!!segments.length && <div className="evidence-locate-actions">
      <span>{segments.length > 1 ? `命中 ${currentIndex + 1}/${segments.length} 段` : "命中1段"}</span>
      {segments.length > 1 ? <><Button onClick={() => locate(-1)}>上一段</Button><Button onClick={() => locate(1)}>下一段</Button></> : <Button onClick={() => locate(0)}>定位 {clock(transcript[segments[0]].at)}</Button>}
    </div>}
  </div>;
}
