import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownToLine, ArrowRight, BarChart3, Check, ChevronDown, ChevronRight, CircleAlert, Download, FileText, FolderClock, History, Layers2, LoaderCircle, MessageSquare, Plus, RotateCcw, Upload } from 'lucide-react';
import { asset, download, generate, request, type Preview, type Provider } from './api';
import { storage, type Message, type Project, type Target } from './storage';
import { Button } from './components/ui/button';
import { Composer } from './components/Composer';
import { PreviewPane, type Playback } from './components/Preview';
import './styles.css';

const entire = { kind: 'deck' } as const;
const staticDemo = import.meta.env.MODE === 'pages';
const examples = ['年間売上を3つの節目で', '新規事業の提案を5枚で', 'プロジェクトの進捗報告'];
const phases = { yaml: 'YAML を生成', build: 'HTML をビルド', check: 'レイアウトを検証', fix: '検証結果をもとに自己修正' };
function targetLabel(target: Target, deck?: Preview) {
  if (target.kind === 'deck') return '';
  if (target.kind === 'slide') return `対象：${target.index + 1}枚目`;
  return `対象：${deck?.slides[target.index - 1]?.name} → ${deck?.slides[target.index]?.name}の切り替え`;
}

function App() {
  const [editing, setEditing] = useState(false);
  const [project, setProject] = useState<Project>();
  const [recent, setRecent] = useState<Project[]>([]);
  const [version, setVersion] = useState(0);
  const [deck, setDeck] = useState<Preview>();
  const [playback, setPlayback] = useState<Playback>();
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<Target>(entire);
  const [text, setText] = useState('');
  const [provider, setProvider] = useState<Provider>('vertex-gemini');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState('');
  const [pending, setPending] = useState<Message>();
  const [steps, setSteps] = useState<string[]>([]);
  const [chars, setChars] = useState(0);
  const partials = useRef<string[]>([]);
  const locked = useRef(false);
  const cache = useRef(new Map<string, Preview>());
  const upload = useRef<HTMLInputElement>(null);
  const exportMenu = useRef<HTMLDetailsElement>(null);
  const endChat = useRef<HTMLDivElement>(null);
  const activeVersion = project?.versions[version - 1];

  useEffect(() => {
    if (staticDemo) return;
    storage.list().then(setRecent).catch((err) => setError(String(err)));
    request<{ provider: Provider }>('/api/config').then((config) => setProvider(config.provider)).catch((err) => setError(String(err)));
  }, []);
  useEffect(() => { endChat.current?.scrollIntoView({ block: 'nearest' }); }, [pending, steps, project]);

  async function perform(work: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await work(); } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { locked.current = false; setBusy(false); }
  }
  function show(media: Preview, at: number) {
    const page = Math.max(0, Math.min(at, media.slides.length - 1));
    setDeck(media); setIndex(page); setPlayback({ source: media, index: page, mode: 'seek' });
  }
  async function mediaFor(doc: Project, number: number) {
    const key = doc.id + ':' + number;
    let media = cache.current.get(key);
    if (!media) {
      media = await request<Preview>('/api/render', { yaml: doc.versions[number - 1].yaml });
      cache.current.set(key, media);
    }
    return media;
  }
  function remember(doc: Project) {
    setProject(doc); setRecent((items) => [doc, ...items.filter((item) => item.id !== doc.id)]);
  }
  async function open(doc: Project, number: number, at = 0) {
    const media = await mediaFor(doc, number);
    setProject(doc); setVersion(number); setEditing(true); setText(''); setTarget(entire); show(media, at);
  }
  function home() {
    cache.current.clear(); setEditing(false); setProject(undefined); setVersion(0); setDeck(undefined);
    setPlayback(undefined); setText(''); setTarget(entire); setError(''); setPending(undefined);
    if (!staticDemo) storage.list().then(setRecent).catch((err) => setError(String(err)));
  }
  function send() {
    const instruction = text.trim();
    if (staticDemo || !instruction) return;
    void perform(async () => {
      const next = (project?.versions.length ?? 0) + 1;
      const user: Message = { role: 'user', text: instruction, version: next, scope: targetLabel(target, deck) };
      setPending(user); setSteps([]); setChars(0); setEditing(true); setText('');
      try {
        const result = await generate({ overview: instruction, provider, yaml: activeVersion?.yaml,
          target: activeVersion ? target : undefined }, (event) => {
          if (event.type === 'phase') {
            setSteps((values) => [...values, phases[event.phase] + `（${event.iteration}回目）`]);
            if (event.phase === 'fix') setChars(0);
          }
          if (event.type === 'text') setChars(event.chars);
          if (event.type === 'preview') {
            partials.current.splice(event.from, partials.current.length, ...event.markup);
            show(event.preview, event.preview.slides.length - 1);
          }
        });
        const reply: Message = { role: 'assistant', version: next, text: project
          ? `${target.kind === 'transition' ? '指定した区間の動き' : target.kind === 'slide' ? (target.index + 1) + '枚目' : '資料全体'}を修正しました。`
          : `${result.preview.slides.length}枚の資料を作成しました。` };
        const doc: Project = {
          format: 1, id: project?.id ?? crypto.randomUUID(), title: result.preview.title, updatedAt: new Date().toISOString(),
          messages: [...(project?.messages ?? []), user, reply],
          versions: [...(project?.versions ?? []), { yaml: result.yaml, parent: version, target }],
        };
        await storage.save(doc, next - 1);
        cache.current.set(doc.id + ':' + next, result.preview);
        remember(doc); setVersion(next); setTarget(entire);
        show(result.preview, target.kind === 'deck' ? (project ? index : 0) : target.index);
      } catch (err) {
        setText(instruction);
        if (deck) show(deck, index);
        else { setDeck(undefined); setPlayback(undefined); }
        throw err;
      } finally { setPending(undefined); setSteps([]); }
    });
  }
  function restore() {
    if (!project || !activeVersion || !deck) return;
    void perform(async () => {
      const latest = project.versions.length;
      const next = latest + 1;
      const doc: Project = { ...project, title: deck.title, updatedAt: new Date().toISOString(),
        versions: [...project.versions, { yaml: activeVersion.yaml, restored: version, parent: latest, target: entire }],
        messages: [...project.messages, { role: 'assistant', version: next, text: `v${version} を復元しました。` }] };
      await storage.save(doc, latest); cache.current.set(doc.id + ':' + next, deck);
      remember(doc); setVersion(next); setTarget(entire); show(deck, index);
    });
  }
  function loadBackup(file?: File) {
    if (staticDemo || !file) return;
    void perform(async () => {
      const { readBackup } = await import('./backup');
      const doc = { ...readBackup(await file.text()), id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
      const media = await mediaFor(doc, doc.versions.length);
      await storage.save(doc, 0); remember(doc); setVersion(doc.versions.length); setTarget(entire);
      setText(''); setEditing(true); show(media, 0);
    });
  }
  function exportFile(format: string) {
    if (!project || !deck) return;
    if (exportMenu.current) exportMenu.current.open = false;
    void perform(async () => {
      const filename = `${project.title}-v${version}.${format}`;
      if (format === 'json') {
        const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
        download(url, filename); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (format === 'html') download(asset(deck, 'html') + '?download=1', filename);
      else {
        setExporting(format.toUpperCase());
        try {
          await request(`/api/jobs/${deck.id}/export`, {});
          download(`/api/jobs/${deck.id}/download-${format}`, filename);
        } finally { setExporting(''); }
      }
    });
  }
  function edit(scope: Target) {
    setTarget(scope); document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();
  }
  const comparison = activeVersion?.target.kind === 'transition' ? { parent: activeVersion.parent, version, index: activeVersion.target.index } : undefined;
  function compare(before: boolean) {
    if (!comparison || !project || !deck) return;
    void perform(async () => {
      const source = before ? await mediaFor(project, comparison.parent) : deck;
      setPlayback({ source, index: comparison.index, mode: 'replay', before });
    });
  }
  const composer = <Composer text={text} setText={setText} send={send} scope={targetLabel(target, deck)}
    clearScope={() => edit(entire)} provider={provider} setProvider={setProvider} home={!editing} busy={busy || staticDemo}/>;
  const notice = error && <div className="error" role="alert"><CircleAlert size={16}/><span>{error}</span></div>;
  return <div className={editing ? 'studio' : 'home'}>
    <header className="app-header">
      <div className="header-start"><button className="brand" onClick={home} disabled={busy} aria-label="Urushi ホーム"><span className="brand-mark" aria-hidden="true"/><span>Urushi</span></button>
        {editing && <><span className="header-divider"/><span className="document-name">{deck?.title ?? project?.title ?? '新しい資料'}</span></>}</div>
      <div className="header-actions">{editing ? <>
        {activeVersion && <label className="versions"><History size={15}/><select aria-label="表示する版" value={version} disabled={busy}
          onChange={(e) => void perform(() => open(project!, Number(e.target.value), index))}>
          {project!.versions.map((_v, i) => <option key={i} value={i + 1}>v{i + 1}{i === project!.versions.length - 1 ? '（最新）' : ''}</option>).reverse()}</select><ChevronDown size={12}/></label>}
        {activeVersion && version < project!.versions.length && <Button variant="outline" disabled={busy} onClick={restore}><RotateCcw size={14}/>この版を復元</Button>}
        {project && <details ref={exportMenu} className="export-menu"><summary aria-label="書き出し" className={busy ? 'inert' : ''}>{exporting ? <><LoaderCircle size={15} className="spin"/>{exporting} を書き出し中</> : <><Download size={15}/>書き出し<ChevronDown size={12}/></>}</summary>
          <div>{[['html', '単体 HTML'], ['pdf', 'PDF'], ['pptx', 'PowerPoint（PPTX）'], ['json', 'バックアップ JSON']].map(([format, label]) =>
            <button key={format} disabled={busy} onClick={() => exportFile(format)}><ArrowDownToLine size={14}/>{label}</button>)}</div></details>}
        <Button variant="ghost" size="icon" disabled={busy} onClick={home} aria-label="新規作成"><Plus size={19}/></Button></>
        : <Button variant="outline" disabled={busy || staticDemo} onClick={() => upload.current?.click()}><Upload size={15}/>JSON を読み込む</Button>}</div>
      <input hidden type="file" accept=".json,application/json" ref={upload} aria-label="バックアップを読み込む"
        onChange={(e) => { loadBackup(e.target.files?.[0]); e.target.value = ''; }}/>
    </header>
    {!editing ? <main className="home-main"><div className="start">
      <h1>どんな資料をつくりますか？</h1>{composer}
      <div className="examples">{examples.map((item, i) => <button key={item} onClick={() => {
        setText(item); document.querySelector('textarea')?.focus();
      }}>{i === 0 ? <BarChart3 size={14}/> : i === 1 ? <Layers2 size={14}/> : <FileText size={14}/>} {item}<ArrowRight size={12}/></button>)}</div>
      {staticDemo && <p className="demo-note">このデモでは要望の入力と例文の選択を試せます。資料の生成・編集・JSON の読み込みには Urushi サーバーが必要です。</p>}
      {notice}
      {recent.length > 0 && <section className="recent"><h2><FolderClock size={17}/>最近の資料</h2>
        {recent.map((doc) => <button key={doc.id} disabled={busy} onClick={() => void perform(() => open(doc, doc.versions.length))}>
          <FileText size={17}/><strong>{doc.title}</strong><small>v{doc.versions.length}</small><ChevronRight size={15}/></button>)}</section>}
    </div></main> : <main className="workspace">
      <section className="chat-pane" aria-label="チャット"><h2 className="chat-title"><MessageSquare size={17}/>チャット</h2>
        <div className="messages" role="log">{[...(project?.messages ?? []), ...(pending ? [pending] : [])].map((msg, i) =>
          <div className={'message ' + msg.role} key={i}>{msg.role === 'assistant' && <span className="assistant-icon"><Layers2 size={15}/></span>}
            <div>{msg.scope && <small>{msg.scope}</small>}<p>{msg.text}</p>{msg.role === 'assistant' &&
            <button disabled={busy} className="version-link" onClick={() => void perform(() => open(project!, msg.version))}>v{msg.version} を表示<ChevronRight size={12}/></button>}</div></div>)}
          {pending && <div className="progress" role="status">{steps.map((step, i) => <div key={i}>
            {i === steps.length - 1 ? <LoaderCircle size={15} className="spin"/> : <Check size={15}/>}
            <span>{step}</span></div>)}<small>{chars.toLocaleString()}文字受信</small></div>}
          {notice}<div ref={endChat}/>
        </div>
        <div className="chat-input"><span className="scope-label">{target.kind === 'deck' ? '修正対象　資料全体' : '修正対象を指定中'}</span>{composer}</div>
      </section>
      <PreviewPane deck={deck} partials={partials.current} playback={playback} index={index} onSlide={setIndex} edit={edit} busy={busy} comparison={comparison} compare={compare}
        select={(at, mode = 'seek') => { if (deck) { setIndex(at); setPlayback({ source: deck, index: at, mode }); } }}/>
    </main>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
