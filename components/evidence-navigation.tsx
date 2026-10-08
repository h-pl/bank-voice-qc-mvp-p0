"use client";
import { useEffect, useState, type RefObject } from "react";
import { Button } from "./ui";

export function EvidenceNavigation({ transcriptRef, segments, total, onLocate }: {
  transcriptRef: RefObject<HTMLDivElement | null>;
  segments: number[];
  total: number;
  onLocate?: (index: number) => void;
}) {
  const [offscreen, setOffscreen] = useState<number[]>([]);
  const [located, setLocated] = useState<number>();
  const segmentKey = segments.join(",");

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript || !segmentKey) return;
    const indices = segmentKey.split(",").map(Number);
    const targets = new Map<Element, number>();
    for (const index of indices) {
      const row = transcript.children[index];
      if (row) targets.set(row, index);
    }
    const outside = new Set(targets.values());
    // The viewport root also accounts for clipping by every ancestor scroll container.
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const index = targets.get(entry.target)!;
        if (entry.isIntersecting && entry.intersectionRect.height > 0 && entry.intersectionRect.width > 0) outside.delete(index);
        else outside.add(index);
      }
      const next = indices.filter(index => outside.has(index));
      setOffscreen(previous => previous.join(",") === next.join(",") ? previous : next);
    }, { threshold: [0, 0.01] });
    targets.forEach((_, row) => observer.observe(row));
    return () => observer.disconnect();
  }, [segmentKey, transcriptRef]);

  const locate = (direction: -1 | 0 | 1) => {
    const current = located === undefined ? -1 : segments.indexOf(located);
    const start = current < 0 ? direction < 0 ? 0 : -1 : current;
    const order = direction === 0 ? segments : segments.map((_, offset) =>
      segments[(start + direction * (offset + 1) + segments.length) % segments.length]);
    const segment = order.find(index => offscreen.includes(index));
    if (segment === undefined) return;
    const row = transcriptRef.current?.children[segment] as HTMLElement | undefined;
    if (!row) return;
    row.scrollIntoView({ block: "center" });
    row.focus({ preventScroll: true });
    setLocated(segment);
    onLocate?.(segment);
  };
  const visible = offscreen.length > 0;
  const locatedIndex = located === undefined ? -1 : segments.indexOf(located);
  return <>
    <div className="evidence-transcript-heading">
      <div><h3>通话转写</h3><span>{total} 段 · 证据 {segments.length} 段</span></div>
      {!!segments.length && <div className="evidence-locate-actions" data-visible={visible} aria-hidden={!visible} inert={!visible}>
        {segments.length > 1 ? <><Button onClick={() => locate(-1)}>上一段证据</Button><Button onClick={() => locate(1)}>下一段证据</Button></> : <Button onClick={() => locate(0)}>定位证据</Button>}
      </div>}
    </div>
    <span className="sr-only" role="status">{locatedIndex >= 0 ? `已定位第 ${locatedIndex + 1} 段证据，共 ${segments.length} 段` : ""}</span>
  </>;
}
