"use client";
import { useEffect, useState, useRef, useImperativeHandle, type RefObject, type PointerEvent } from "react";
import { Play, Pause, Volume2, VolumeX, Headphones, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { recordingTimestamp as clock } from "../lib/evidence-clip";
import { recordingRanges, recordingSegmentAt } from "../lib/recording-timeline";

export type RecordingController = { seek: (time: number) => void };
type Props = {
  controller: RefObject<RecordingController | null>;
  src: string; synthetic?: boolean; expectedDuration?: number; waveform?: number[];
  transcript: { at: number; speaker: string; text: string }[]; evidence: number[];
  initialTime?: number; selected: number; hovered?: number;
  onTime: (time: number) => void; onPlaying: (playing: boolean) => void;
  onDuration: (duration: number) => void; onSeek: (time: number) => void; onHover: (index?: number) => void;
};

export function AudioPlayer({ controller, src, synthetic, expectedDuration = 0, waveform = [], transcript, evidence, initialTime, selected, hovered, onTime, onPlaying, onDuration, onSeek, onHover }: Props) {
  const media = useRef<HTMLAudioElement>(null);
  const pendingSeek = useRef<number | undefined>(initialTime);
  const [playing, setPlaying] = useState(false), [current, setCurrent] = useState(initialTime ?? 0);
  const [duration, setDuration] = useState(expectedDuration), [ready, setReady] = useState(false);
  const [volume, setVolume] = useState(1), [speed, setSpeed] = useState("1");
  const [error, setError] = useState(false), [waiting, setWaiting] = useState(false);
  const [hoverTime, setHoverTime] = useState<number>();
  const ranges = recordingRanges(transcript, evidence, duration);
  const failed = () => { setError(true); setWaiting(false); setPlaying(false); onPlaying(false); };
  const updateTime = (time: number) => { setCurrent(time); onTime(time); };
  const seek = (time: number) => {
    const value = Math.min(duration || time, Math.max(0, time));
    if (media.current && media.current.readyState >= 1) media.current.currentTime = value;
    else pendingSeek.current = value;
    updateTime(value); onSeek(value);
  };
  useImperativeHandle(controller, () => ({ seek }));
  useEffect(() => {
    const element = media.current;
    const pauseHidden = () => { if (document.hidden) element?.pause(); };
    document.addEventListener("visibilitychange", pauseHidden);
    return () => { element?.pause(); document.removeEventListener("visibilitychange", pauseHidden); };
  }, []);
  const play = () => {
    const element = media.current;
    if (!element) return;
    if (playing) element.pause();
    else { if (element.ended) seek(0); void element.play().catch(failed); }
  };
  const hoverAxis = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || !duration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const time = Math.max(0, Math.min(duration, (event.clientX - bounds.left) / bounds.width * duration));
    setHoverTime(time); onHover(recordingSegmentAt(transcript, time, duration));
  };
  const clearHover = () => { setHoverTime(undefined); onHover(undefined); };
  const ticks = Array.from({ length: 5 }, (_, index) => duration * index / 4);
  return <section className="recording-player recording-player-linked" aria-label="通话录音播放器">
    <audio ref={media} data-qc-recording src={src} preload="metadata"
      onLoadedMetadata={event => {
        const element = event.currentTarget;
        const length = Number.isFinite(element.duration) ? element.duration : 0;
        setDuration(length); onDuration(length); setReady(length > 0); setError(false);
        if (pendingSeek.current !== undefined) {
          const time = Math.min(length, pendingSeek.current);
          element.currentTime = time; updateTime(time); pendingSeek.current = undefined;
        }
      }}
      onPlay={event => {
        document.querySelectorAll<HTMLAudioElement>("audio[data-qc-recording]").forEach(other => { if (other !== event.currentTarget) other.pause(); });
        setPlaying(true); onPlaying(true); updateTime(event.currentTarget.currentTime);
      }}
      onPause={() => { setPlaying(false); onPlaying(false); }}
      onEnded={() => { setPlaying(false); onPlaying(false); }} onError={failed}
      onWaiting={() => setWaiting(true)} onPlaying={() => setWaiting(false)}
      onSeeked={event => updateTime(event.currentTarget.currentTime)}
      onTimeUpdate={event => updateTime(event.currentTarget.currentTime)}/>
    <div className="recording-header">
    <div className="recording-heading"><span><Headphones size={16} aria-hidden="true"/>通话录音</span><small role="status" data-error={error}>{error ? "录音加载失败" : waiting ? "正在缓冲…" : synthetic ? "合成音频" : ""}</small></div>
      {ranges.some(range => range.hit) && <div className="recording-hit-links" aria-label="音频命中片段">{ranges.filter(range => range.hit).map(range => <button type="button" className="recording-hit-range" key={range.index} aria-label={`定位命中片段 ${clock(range.start)} 至 ${clock(range.end)}`} aria-pressed={selected === range.index} data-hovered={hovered === range.index} disabled={!ready || error} onClick={() => seek(range.start)} onPointerEnter={() => onHover(range.index)} onPointerLeave={clearHover} onFocus={() => onHover(range.index)} onBlur={clearHover}><span>命中 {clock(range.start)}</span></button>)}</div>}
    </div>
    <div className="recording-playback">
      <Button type="button" size="icon" className="recording-play" aria-label={playing ? "暂停录音" : "播放录音"} disabled={!ready || error} onClick={play}>{playing ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}</Button>
    <div className="recording-timeline">
      <div className="recording-axis" onPointerMove={hoverAxis} onPointerLeave={clearHover}>
        <div className="recording-regions" aria-hidden="true">{ranges.map(range => <span key={range.index} data-hit={range.hit} data-selected={selected === range.index} data-hovered={hovered === range.index} style={{ left: `${range.start / duration * 100}%`, width: `${(range.end - range.start) / duration * 100}%` }}/>)}</div>
        {waveform.length ? <div className="recording-waveform" aria-hidden="true">{waveform.map((height, index) => <span key={index} data-past={index / waveform.length * duration < current} style={{ height: `${Math.max(2, height * 42)}px` }}/>)}</div> : <div className="recording-axis-baseline" aria-hidden="true"/>}
        <Slider className="recording-wave-slider" aria-label="录音播放进度" aria-valuetext={`${clock(current)} / ${clock(duration)}`} disabled={!ready || error} min={0} max={duration || 1} step={0.1} value={[Math.min(current, duration || 0)]} onValueChange={value => seek(value[0])}/>
        {hoverTime !== undefined && <span className="recording-axis-hover" aria-hidden="true" style={{ left: `${Math.max(6, Math.min(94, hoverTime / duration * 100))}%` }}>{clock(hoverTime)}</span>}
      </div>
      <div className="recording-axis-ticks" aria-hidden="true">{ticks.map((time, index) => <span key={index}>{clock(time)}</span>)}</div>
    </div>
    </div>
    <div className="recording-controls">
      <Button type="button" size="icon" variant="ghost" aria-label="后退 5 秒" disabled={!ready || error} onClick={() => seek(current - 5)}><RotateCcw aria-hidden="true"/></Button>
      <span className="recording-time" aria-label={`当前 ${clock(current)}，总时长 ${clock(duration)}`}>{clock(current)}<span> / {clock(duration)}</span></span>
      <div className="recording-options"><Popover><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label="音量设置">{volume ? <Volume2 aria-hidden="true"/> : <VolumeX aria-hidden="true"/>}</Button></PopoverTrigger><PopoverContent className="recording-volume" align="end"><span>音量 {Math.round(volume * 100)}%</span><Slider aria-label="录音音量" min={0} max={1} step={0.01} value={[volume]} onValueChange={value => { setVolume(value[0]); if (media.current) media.current.volume = value[0]; }}/></PopoverContent></Popover>
        <Select value={speed} onValueChange={value => { setSpeed(value); if (media.current) media.current.playbackRate = Number(value); }}><SelectTrigger aria-label="播放倍速" className="recording-speed"><SelectValue/></SelectTrigger><SelectContent>{["0.75", "1", "1.25", "1.5", "2"].map(value => <SelectItem key={value} value={value}>{value}×</SelectItem>)}</SelectContent></Select>
      </div>
    </div>
    {error ? <p className="recording-hint recording-error" role="alert">录音暂不可用，可继续查看转写。<Button type="button" variant="link" onClick={() => { setError(false); setWaiting(true); media.current?.load(); }}>重新加载</Button></p> : null}
  </section>;
}
