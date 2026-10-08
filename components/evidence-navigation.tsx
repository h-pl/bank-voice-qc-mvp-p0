"use client";
import { type RefObject } from "react";
import { Button } from "./ui/button";
import { recordingTimestamp as clock } from "../lib/evidence-clip";

export function EvidenceNavigation({ transcriptRef, segments, transcript, current, onLocate }: {
  transcriptRef: RefObject<HTMLDivElement | null>;
  segments: number[];
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
  if (!segments.length) return null;
  return <div className="evidence-locate-actions" role="group" aria-label="命中片段导航">
    {segments.length > 1 ? <>
      <span aria-label={`命中第${currentIndex + 1}段，共${segments.length}段`}>{currentIndex + 1}/{segments.length}</span>
      <Button type="button" variant="outline" onClick={() => locate(-1)}>上一段</Button><Button type="button" variant="outline" onClick={() => locate(1)}>下一段</Button>
    </> : <Button type="button" variant="outline" title={`定位到 ${clock(transcript[segments[0]].at)}`} onClick={() => locate(0)}>定位命中</Button>}
  </div>;
}
