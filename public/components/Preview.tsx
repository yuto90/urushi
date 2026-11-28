import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Expand, Frame, Monitor, PencilLine, Play, SquarePen } from 'lucide-react';
import { asset, type Preview } from '../api';
import type { Target } from '../storage';
import { Button } from './ui/button';

export interface Playback { source: Preview; index: number; mode: 'seek' | 'replay' | 'advance'; before?: boolean }
export function PreviewPane({ deck, playback, index, select, onSlide, edit, compare, comparison, busy }: {
  deck?: Preview; playback?: Playback; index: number;
  select(index: number, mode?: Playback['mode']): void; onSlide(index: number): void;
  edit(target: Target): void; compare(before: boolean): void; comparison?: { parent: number; version: number; index: number }; busy: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const src = playback && asset(playback.source, 'html');
  const send = () => {
    if (!playback) return;
    frame.current?.contentWindow?.postMessage({ type: 'urushi:' + playback.mode, index: playback.index }, '*');
  };
  useEffect(send, [playback]);
  useEffect(() => {
    function message(event: MessageEvent) {
      if (event.source === frame.current?.contentWindow && event.data?.type === 'urushi:slide' &&
          Number.isInteger(event.data.index) && deck?.slides[event.data.index]) onSlide(event.data.index);
    }
    window.addEventListener('message', message);
    return () => window.removeEventListener('message', message);
  }, [deck, onSlide]);
  const slide = deck?.slides[index];
  const interval = slide?.interval && index > 0 ? `${deck!.slides[index - 1].name} → ${slide.name}` : '';
  return <section className="preview-pane" aria-label="プレビュー">
    <div className="preview-toolbar"><h2><Monitor size={17}/>プレビュー</h2>
      <div className="toolbar-actions"><Button variant="outline" onClick={() => edit({ kind: 'slide', index })} disabled={busy || !slide}><SquarePen size={15}/>この1枚を修正</Button>
        <Button variant="ghost" size="icon" aria-label="全画面で発表" disabled={!slide} onClick={async () => {
          if (frame.current) { await frame.current.requestFullscreen().catch(() => {}); frame.current.focus(); }
        }}><Expand size={17}/></Button></div></div>
    <div className="canvas-area"><div className="canvas">
      {src ? <iframe className="deck-frame" key={src} ref={frame} title="スライドプレビュー" sandbox="allow-scripts" allow="fullscreen" src={src} onLoad={send}/>
        : <div className="empty-canvas"><Frame size={38}/><span>最初のスライドを待っています</span></div>}
    </div>
    {deck && <div className="page-controls"><Button variant="ghost" size="icon" aria-label="前の節目" disabled={!index}
      onClick={() => select(index - 1)}><ChevronLeft size={16}/></Button><span>{index + 1} / {deck.slides.length}</span>
      <Button variant="ghost" size="icon" aria-label="次の節目" disabled={index + 1 >= deck.slides.length}
        onClick={() => select(index + 1, 'advance')}><ChevronRight size={16}/></Button></div>}</div>
    {deck && <div className="filmstrip-area">
      <div className={deck.slides.some((s) => s.interval) ? 'interval-row' : undefined}>{interval && <div className="interval-controls"><Button variant="ghost" size="small" onClick={() => select(index, 'replay')}><Play size={14}/>{interval}を再生</Button>
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
