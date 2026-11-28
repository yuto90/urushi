import { ArrowUp, ChevronDown, Cpu, X } from 'lucide-react';
import { Button } from './ui/button';
import type { Provider } from '../api';

export function Composer({ text, setText, send, scope, clearScope, provider, setProvider, home, busy, fixedModel }: {
  text: string; setText(value: string): void; send(): void;
  scope: string; clearScope(): void; provider: Provider; setProvider(value: Provider): void;
  home?: boolean; busy: boolean; fixedModel?: boolean;
}) {
  return <form className={'composer' + (home ? ' home-composer' : '')} onSubmit={(event) => { event.preventDefault(); send(); }}>
    {scope && <button type="button" className="scope" onClick={clearScope} aria-label={scope + 'を解除'}>{scope}<X size={13}/></button>}
    <textarea aria-label={home ? '資料の要望' : '修正の依頼'} value={text} onChange={(e) => setText(e.target.value)}
      placeholder={home ? '資料のテーマや、伝えたいことを入力…' : 'どのように修正しますか？'}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
          e.preventDefault(); if (!busy && text.trim()) send();
        }
      }}/>
    <div className="composer-footer"><label className="provider"><Cpu size={15}/>
      {fixedModel ? <span>Gemini 4 Neon</span> : <><select aria-label="生成モデル" value={provider} onChange={(e) => setProvider(e.target.value as Provider)} disabled={busy}>
        <option value="vertex-gemini">Gemini 4 Neon</option><option value="mock">Mock</option>
        <option value="vertex-claude">Vertex Claude</option>
      </select><ChevronDown size={12}/></>}</label>
      <Button type="submit" size="icon" aria-label="送信" disabled={busy || !text.trim()}><ArrowUp size={19}/></Button>
    </div>
  </form>;
}
