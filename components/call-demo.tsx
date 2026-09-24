'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './call-demo.module.css';
import { Button } from './ui/button';
import { Badge } from './ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

type Phase = 'idle' | 'connecting' | 'live' | 'loading' | 'ready';
type Clip = { blob: Blob; duration: number; source: 'mic' | 'upload' };
const timeLabel = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

function DemoIcon({ name }: { name: 'phone' | 'mic' | 'upload' | 'close' | 'end' }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'phone' && <><path d="M8 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-4l-5-2-2 2a14 14 0 0 1-6-6l2-2-2-5Z"/><path d="M15 3h6v6m0-6-7 7"/></>}
    {name === 'end' && <path d="M3 15v-4c5-5 13-5 18 0v4h-5v-3a13 13 0 0 0-8 0v3H3Z"/>}
    {name === 'mic' && <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></>}
    {name === 'upload' && <path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>}
    {name === 'close'  && <path d="m6 6 12 12M6 18 18 6"/>}
  </svg>;
}

export default function CallDemo() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<'mic' | 'upload'>('mic');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [clip, setClip] = useState<Clip | null>(null);
  const [error, setError] = useState('');
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [uploadClip, setUploadClip] = useState<(Clip & { name: string }) | null>(null);
  const [uploadError, setUploadError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const busy = phase === 'connecting' || phase === 'live' || phase === 'loading' || uploadPhase === 'loading';

  function releaseInput() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    void audioContext.current?.close().catch(() => {});
    audioContext.current = null;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
      releaseInput();
    };
  }, []);

  function saveClip(blob: Blob, duration: number, source: 'mic' | 'upload', name = '通话录音') {
    if (source === 'upload') {
      setUploadClip({ blob, duration, source, name });
      setUploadPhase('ready');
    } else {
      setClip({ blob, duration, source });
      setSeconds(duration);
      setPhase('ready');
    }
  }

  function endCall() {
    if (recorder.current?.state === 'recording') {
      setPhase('loading');
      recorder.current.stop();
      releaseInput();
      setLevel(0);
    }
  }

  function closePanel() {
    if (phase === 'connecting') {
      generation.current += 1;
      setPhase(clip ? 'ready' : 'idle');
    }
    endCall();
    setOpen(false);
    trigger.current?.focus();
  }

  async function startCall() {
    if (busy) return;
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('当前环境无法使用麦克风，请使用 HTTPS 或本机浏览器访问。');
      return;
    }
    const request = ++generation.current;
    setPhase('connecting');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!mounted.current || request !== generation.current) {
        media.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = media;
      const recording = new MediaRecorder(media);
      recorder.current = recording;
      const chunks: Blob[] = [];
      const startedAt = Date.now();
      let failed = false;
      recording.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recording.onstop = () => {
        releaseInput();
        if (!mounted.current || request !== generation.current || failed) return;
        const blob = new Blob(chunks, { type: recording.mimeType || 'audio/webm' });
        if (!blob.size) {
          setError('未收到有效录音，请重新接入电话。');
          setPhase(clip ? 'ready' : 'idle');
          return;
        }
        saveClip(blob, (Date.now() - startedAt) / 1000, 'mic');
      };
      recording.onerror = () => {
        failed = true;
        releaseInput();
        if (mounted.current) {
          setError('录音中断，请检查麦克风后重新接入。');
          setPhase(clip ? 'ready' : 'idle');
        }
      };
      media.getAudioTracks().forEach(track => { track.onended = () => {
        if (recording.state === 'recording') recording.stop();
      }; });
      // Audio metering is optional; a missing Web Audio implementation must not prevent recording.
      let analyser: AnalyserNode | null = null;
      try {
        const context = new AudioContext();
        audioContext.current = context;
        await context.resume();
        if (!mounted.current || request !== generation.current) { releaseInput(); return; }
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(media).connect(analyser);
      } catch { /* Recording remains available without a level meter. */ }
      recording.start(250);
      setSeconds(0);
      setLevel(0);
      setPhase('live');
      const samples = new Uint8Array(256);
      timer.current = setInterval(() => {
        setSeconds((Date.now() - startedAt) / 1000);
        if (analyser) {
          analyser.getByteTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length);
          setLevel(Math.min(1, rms * 5));
        }
        if (Date.now() - startedAt >= 30 * 60 * 1000) {
          recording.stop();
          releaseInput();
        }
      }, 100);
    } catch (reason) {
      releaseInput();
      if (!mounted.current || request !== generation.current) return;
      const code = reason instanceof DOMException ? reason.name : '';
      setError(code === 'NotAllowedError' ? '麦克风权限未开启，请在浏览器中允许后重试。' : code === 'NotFoundError' ? '未找到麦克风，请连接设备后重试。' : '无法接入麦克风，请检查设备是否被占用后重试。');
      setPhase(clip ? 'ready' : 'idle');
    }
  }

  async function loadFile(file?: File) {
    if (!file || busy) return;
    setUploadError('');
    if (!file.size || file.size > 50 * 1024 * 1024) {
      setUploadError('请选择非空音频文件，大小不超过 50 MB。');
      return;
    }
    if (!file.type.startsWith('audio/') && !/\.(wav|mp3|m4a|ogg|webm|flac|aac)$/i.test(file.name)) {
      setUploadError('请选择 WAV、MP3、M4A 等音频文件。');
      return;
    }
    const request = ++generation.current;
    setUploadPhase('loading');
    let decoder: AudioContext | undefined;
    try {
      decoder = new AudioContext();
      const decoded = await decoder.decodeAudioData(await file.arrayBuffer());
      if (mounted.current && request === generation.current) saveClip(file, decoded.duration, 'upload', file.name);
    } catch {
      if (mounted.current && request === generation.current) {
        setUploadError('无法读取该音频，请检查文件是否损坏，或转换为 WAV / MP3 后重试。');
        setUploadPhase(uploadClip ? 'ready' : 'idle');
      }
    } finally { await decoder?.close().catch(() => {}); }
  }

  function removeUpload() {
    setUploadClip(null);
    setUploadPhase('idle');
    setUploadError('');
    setDragging(false);
    if (input.current) input.current.value = '';
    requestAnimationFrame(() => { if (mounted.current) uploadTarget.current?.focus(); });
  }

  const phoneStatus = phase === 'live' ? '通话中 · 正在拾音' : phase === 'connecting' ? '等待麦克风授权' : phase === 'loading' ? '正在保存录音' : clip ? '通话已结束' : '等待来电接入';
  const uploadStatus = uploadPhase === 'loading' ? '正在读取音频' : uploadClip ? '音频已接入' : '等待上传录音';
  const status = source === 'mic' ? phoneStatus : uploadStatus;
  const statusTone = (source === 'mic' ? phase === 'live' : uploadPhase === 'ready') ? 'success' : 'neutral';
  const displayedSeconds = source === 'mic' ? seconds : uploadClip?.duration ?? 0;
  const displayedError = source === 'mic' ? error : uploadError;

  return <>
    <button ref={trigger} className={`${styles.trigger} ${open ? styles.selected : ''}`} title="模拟电话接入" aria-label="模拟电话接入" aria-expanded={open} aria-controls={open ? 'call-demo-panel' : undefined} onClick={() => setOpen(true)}>
      <DemoIcon name="phone"/>{phase === 'live' && <i className={styles.liveDot}/>}
    </button>
    {open && createPortal(<section id="call-demo-panel" className={styles.panel} aria-label="模拟电话接入">
      <header className={styles.header}>
        <div><div className={styles.heading}><h2>模拟电话接入</h2><Badge>演示</Badge></div><p>实时拾音或上传通话录音</p></div>
        <Button variant="ghost" size="icon-sm" className={styles.iconButton} title="关闭卡片并结束拾音" aria-label="关闭接入卡片并结束拾音" onClick={closePanel}><DemoIcon name="close"/></Button>
      </header>
      <div className={styles.body}>
        <Tabs value={source} onValueChange={value => { if (!busy) { setSource(value as 'mic' | 'upload'); } }}>
          <TabsList variant="line" className={`ui-tabs ${styles.tabs}`} aria-label="音频来源">
            <TabsTrigger value="mic" disabled={busy}><DemoIcon name="mic"/>实时拾音</TabsTrigger>
            <TabsTrigger value="upload" disabled={busy}><DemoIcon name="upload"/>上传音频</TabsTrigger>
          </TabsList>
          <TabsContent value={source} className={styles.sourceContent}>
        {source === 'upload' && <>
          <input ref={input} type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac,.aac" className="sr-only" tabIndex={-1} aria-label="选择演示音频" onChange={event => { void loadFile(event.target.files?.[0]); event.target.value = ''; }}/>
          {uploadClip && uploadPhase === 'ready' ? <div className={styles.uploadedFile}>
            <span className={styles.fileName} title={uploadClip.name}>{uploadClip.name}</span>
            <Button variant="ghost" size="icon-sm" className={styles.removeFile} aria-label="移除已接入音频" title="移除音频" onClick={removeUpload}><DemoIcon name="close"/></Button>
          </div> : <button ref={uploadTarget} className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`} disabled={busy} onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void loadFile(event.dataTransfer.files[0]); }}><b>{uploadPhase === 'loading' ? '正在读取音频…' : '选择或拖入通话录音'}</b><small>WAV、MP3、M4A 等 · 最大 50 MB</small></button>}
        </>}
        <div className={styles.status}>
          <span role="status"><Badge tone={statusTone}>{status}</Badge></span><time>{timeLabel(displayedSeconds)}</time>
        </div>
        {source === 'mic' && phase === 'live' && <div className={styles.meter} aria-label="麦克风输入音量" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>{Array.from({ length: 32 }, (_, i) => <i key={i} style={{ opacity: i / 32 < level ? 1 : .18, height: `${8 + (i * 7 % 17)}px` }}/>)}</div>}
        {source === 'mic' && <Button variant={phase === 'live' ? 'destructive' : 'default'} className={`btn ${phase === 'live' ? styles.hangup : 'primary'} ${styles.primary}`} disabled={phase === 'connecting' || phase === 'loading'} onClick={phase === 'live' ? endCall : () => void startCall()}><DemoIcon name={phase === 'live' ? 'end' : 'phone'}/>{phase === 'live' ? '结束通话' : phase === 'connecting' ? '正在接入…' : phase === 'loading' ? '正在保存录音…' : clip ? '重新接入电话' : '接入电话并开始拾音'}</Button>}
        {displayedError && <p className={styles.error} role="alert">{displayedError}</p>}
          </TabsContent>
        </Tabs>
      </div>
    </section>, document.body)}
  </>;
}
