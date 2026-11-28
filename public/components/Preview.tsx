import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, Expand, Frame, Monitor, PencilLine, Play, SquarePen } from 'lucide-react';
import { asset, type Preview } from '../api';
import type { Target } from '../storage';
import { Button } from './ui/button';

export interface Playback { source: Preview; index: number; mode: 'seek' | 'replay' | 'advance'; before?: boolean }
function DeckFrame({ playback, src, frame, onSlide }: {
  playback: Playback; src: string; frame: RefObject<HTMLIFrameElement | null>; onSlide(index: number): void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== 'urushi:slide') return;
      if (Number.isInteger(event.data.index) && playback.source.slides[event.data.index]) {
        setReady(true);
        onSlide(event.data.index);
      }
    }
    function forwardKey(event: KeyboardEvent) {
      if (!frame.current || (document.activeElement !== frame.current && document.fullscreenElement !== frame.current)) return;
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      frame.current.contentWindow?.postMessage({ type: 'urushi:key', key: event.key }, '*');
    }
    window.addEventListener('message', receive);
    window.addEventListener('keydown', forwardKey);
    return () => {
      window.removeEventListener('message', receive);
      window.removeEventListener('keydown', forwardKey);
    };
  }, [frame, onSlide, playback.source]);
  useLayoutEffect(() => {
    if (loaded) frame.current?.contentWindow?.postMessage({ type: 'urushi:' + playback.mode, index: playback.index }, '*');
  }, [frame, loaded, playback]);
  // Reveal only after the runtime has applied the requested state. An early keypress
  // can otherwise race a second seek from the iframe load event.
  return <iframe className="deck-frame" ref={frame} title="スライドプレビュー" sandbox="allow-scripts" allow="fullscreen"
    style={{visibility: ready ? 'visible' : 'hidden'}} src={src} onLoad={() => setLoaded(true)}/>;
}

export function PreviewPane({ deck, partials, playback, index, select, onSlide, edit, compare, comparison, busy }: {
  deck?: Preview; partials: string[]; playback?: Playback; index: number;
  select(index: number, mode?: Playback['mode']): void; onSlide(index: number): void;
  edit(target: Target): void; compare(before: boolean): void; comparison?: { parent: number; version: number; index: number }; busy: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const streamFrame = useRef<HTMLIFrameElement>(null);
  const partial = !!playback?.source.snapshot;
  const src = !partial && playback && asset(playback.source, 'html');
  const sendPartial = () => {
    if (!partial || !playback) return;
    streamFrame.current?.contentWindow?.postMessage({ type: 'urushi:partial', html: partials[playback.index],
      position: `${playback.index + 1} / ${playback.source.slides.length}` }, '*');
  };
  useLayoutEffect(sendPartial, [partial, partials, playback]);
  const slide = deck?.slides[index];
  const interval = slide?.interval && index > 0 ? `${deck!.slides[index - 1].name} → ${slide.name}` : '';
  return <section className="preview-pane" aria-label="プレビュー">
    <div className="preview-toolbar"><h2><Monitor size={17}/>プレビュー</h2>
      <div className="toolbar-actions"><Button variant="outline" onClick={() => edit({ kind: 'slide', index })} disabled={busy || !slide}><SquarePen size={15}/>この1枚を修正</Button>
        <Button variant="ghost" size="icon" aria-label="全画面で発表" disabled={!slide || partial} onClick={async () => {
          if (frame.current) { await frame.current.requestFullscreen().catch(() => {}); frame.current.contentWindow?.focus(); }
        }}><Expand size={17}/></Button></div></div>
    <div className="canvas-area"><div className="canvas">
      <iframe className={'stream-frame' + (partial ? ' visible-frame' : '')} ref={streamFrame} title="生成途中のスライド"
        aria-hidden={!partial} tabIndex={-1} sandbox="allow-scripts" src="/api/preview-frame" onLoad={sendPartial}/>
      {src && playback ? <DeckFrame key={src} src={src} frame={frame} playback={playback} onSlide={onSlide}/>
        : !partial && <div className="empty-canvas"><Frame size={38}/><span>最初のスライドを待っています</span></div>}
    </div>
    {deck && <div className="page-controls"><Button variant="ghost" size="icon" aria-label="前の節目" disabled={!index}
      onClick={() => select(index - 1)}><ChevronLeft size={16}/></Button><span>{index + 1} / {deck.slides.length}</span>
      <Button variant="ghost" size="icon" aria-label="次の節目" disabled={index + 1 >= deck.slides.length}
        onClick={() => select(index + 1, 'advance')}><ChevronRight size={16}/></Button></div>}</div>
    {deck && <div className="filmstrip-area">
      <div className={deck.slides.some((s) => s.interval) ? 'interval-row' : undefined}>{interval && <div className="interval-controls"><Button variant="ghost" size="small" disabled={partial} onClick={() => select(index, 'replay')}><Play size={14}/>{interval}を再生</Button>
        <Button variant="outline" size="small" disabled={busy} onClick={() => edit({ kind: 'transition', index })}><PencilLine size={14}/>この区間を修正</Button></div>}</div>
      <div className={comparison ? 'interval-row' : undefined}>{comparison?.index === index && <div className="compare"><span>区間を比較</span>
        <Button size="small" variant={playback?.before ? 'default' : 'outline'} disabled={busy} onClick={() => compare(true)}><Play size={13}/>変更前 v{comparison.parent}</Button>
        <Button size="small" variant={!playback?.before ? 'default' : 'outline'} disabled={busy} onClick={() => compare(false)}><Play size={13}/>変更後 v{comparison.version}</Button></div>}</div>
      <nav className="filmstrip" aria-label="スライド一覧">{deck.slides.map((item, i) =>
        <button key={i} className="thumb" aria-current={i === index ? 'page' : undefined} onClick={() => select(i)}>
          <span className="thumb-image"><iframe title={`${i + 1}枚目の縮小表示`} sandbox="" tabIndex={-1} loading="lazy" src={asset(deck, 'thumb', i)}/></span>
          <span className="thumb-name"><b>{String(i + 1).padStart(2, '0')}</b>{item.name}</span>
        </button>)}</nav>
    </div>}
  </section>;
}
