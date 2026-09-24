"use client";
import { useState, useRef, useImperativeHandle, type RefObject } from "react";
import { Play, Pause, Volume2, VolumeX, Headphones, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
const clock=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,"0")}:${Math.floor(seconds%60).toString().padStart(2,"0")}`;
export function AudioPlayer({audio,src,onTime,onPlaying,onError}: {audio:RefObject<HTMLAudioElement|null>;src:string;onTime:(time:number)=>void;onPlaying:(playing:boolean)=>void;onError:()=>void}) {
  const media=useRef<HTMLAudioElement>(null);
  useImperativeHandle(audio,()=>media.current!,[]);
  const [playing,setPlaying]=useState(false),[current,setCurrent]=useState(0),[duration,setDuration]=useState(0),[volume,setVolume]=useState(1),[speed,setSpeed]=useState("1"),[error,setError]=useState(false),[waiting,setWaiting]=useState(false);
  const failed=()=>{setError(true);setWaiting(false);setPlaying(false);onPlaying(false);onError();};
  const seek=(value:number)=>{if(media.current && duration){media.current.currentTime=Math.min(duration,Math.max(0,value));setCurrent(media.current.currentTime);onTime(media.current.currentTime);}};
  const play=()=>{if(!media.current)return;if(playing)media.current.pause();else void media.current.play().catch(failed);};
  return <section className="recording-player" aria-label="通话录音播放器">
    <audio ref={media} src={src} preload="metadata" onLoadedMetadata={event=>setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onPlay={()=>{setPlaying(true);onPlaying(true);}} onPause={()=>{setPlaying(false);onPlaying(false);}} onEnded={()=>{setPlaying(false);onPlaying(false);}} onError={failed} onWaiting={()=>setWaiting(true)} onPlaying={()=>setWaiting(false)} onTimeUpdate={event=>{setCurrent(event.currentTarget.currentTime);onTime(event.currentTarget.currentTime);}}/>
    <div className="recording-heading"><span><Headphones size={16}/>通话录音</span><small>{error ? "录音暂不可用" : waiting ? "正在缓冲…" : "合成音频"}</small></div>
    <div className="recording-controls"><Button type="button" size="icon" aria-label={playing ? "暂停录音" : "播放录音"} disabled={error} onClick={play}>{playing ? <Pause/> : <Play/>}</Button><Button type="button" size="icon" variant="ghost" aria-label="后退 5 秒" disabled={!duration || error} onClick={()=>seek(current-5)}><RotateCcw/></Button><span className="recording-time">{clock(current)}</span><Slider aria-label="录音播放进度" aria-valuetext={`${clock(current)} / ${clock(duration)}`} disabled={!duration || error} min={0} max={duration || 1} step={0.1} value={[Math.min(current,duration || 0)]} onValueChange={value=>seek(value[0])}/><span className="recording-time">{clock(duration)}</span><Popover><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label="音量设置">{volume ? <Volume2/> : <VolumeX/>}</Button></PopoverTrigger><PopoverContent className="recording-volume" align="end"><span>音量 {Math.round(volume*100)}%</span><Slider aria-label="录音音量" min={0} max={1} step={0.01} value={[volume]} onValueChange={value=>{setVolume(value[0]);if(media.current)media.current.volume=value[0];}}/></PopoverContent></Popover><Select value={speed} onValueChange={value=>{setSpeed(value);if(media.current)media.current.playbackRate=Number(value);}}><SelectTrigger aria-label="播放倍速" className="recording-speed"><SelectValue/></SelectTrigger><SelectContent>{["0.75","1","1.25","1.5","2"].map(value=><SelectItem key={value} value={value}>{value}×</SelectItem>)}</SelectContent></Select></div>
    <p className="recording-hint">点击下方转写时间，可定位回听对应片段。</p>
  </section>;
}
