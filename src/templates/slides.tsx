import type {
  CausalSlide,
  ComparisonSlide,
  ConclusionSlide,
  CustomSlide,
  ListSlide,
  ProcessSlide,
  Slide,
} from '../schema/index.js';

const typeLabels: Record<Slide['type'], string> = {
  conclusion: '結論',
  comparison: '比較',
  causal: '因果',
  process: '手順',
  list: '一覧',
  custom: '自由HTML',
  chart: 'グラフ',
};

function textCheck(path: string, maxChars: number) {
  return {
    'data-check-text': true,
    'data-check-path': path,
    'data-max-chars': maxChars,
  };
}

function animationAttributes(slide: Slide, fallback: string) {
  return {
    'data-anim': slide.animation ?? fallback,
    'data-anim-trigger': 'slide-enter',
  };
}

function SlideHeader(props: { slide: Slide; index: number; title?: string }) {
  const title = props.title ?? ('title' in props.slide ? props.slide.title : undefined);
  return (
    <header class="slide-header">
      <div>
        <div class="eyebrow">{typeLabels[props.slide.type]}</div>
        {title ? (
          <h1 class="slide-title" {...textCheck('title', 34)}>
            {title}
          </h1>
        ) : null}
      </div>
      <div class="slide-number">{String(props.index + 1).padStart(2, '0')}</div>
    </header>
  );
}

function ConclusionTemplate(props: { slide: ConclusionSlide; index: number }) {
  const { slide } = props;
  return (
    <div class="slide-inner">
      <SlideHeader slide={slide} index={props.index} />
      <div class="slide-body conclusion-layout" {...animationAttributes(slide, 'assemble')}>
        <p class="conclusion-statement u-part" data-part {...textCheck('conclusion', 90)}>
          {slide.conclusion}
        </p>
        {slide.evidence?.length ? (
          <div class="conclusion-evidence">
            {slide.evidence.map((item, index) => (
              <div class="evidence-chip u-part" data-part {...textCheck(`evidence[${index}]`, 40)}>
                {item}
              </div>
            ))}
          </div>
        ) : null}
        {slide.callToAction ? (
          <div class="call-to-action u-part" data-part {...textCheck('callToAction', 34)}>
            {slide.callToAction}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ScoreBlock(props: { score?: number; path: string }) {
  if (props.score === undefined) return null;
  const score = Math.round(props.score);
  return (
    <div class="score-block">
      <span class="score-number u-count" data-value={score} {...textCheck(`${props.path}.score`, 8)}>
        {score}
      </span>
      <span class="score-label">/ 100</span>
      <div class="bar-track">
        <span class="u-bar" data-value={score} style={`--bar-value:${score}%`} />
      </div>
    </div>
  );
}

function ComparisonTemplate(props: { slide: ComparisonSlide; index: number }) {
  const { slide } = props;
  const renderSide = (side: ComparisonSlide['left'], key: 'left' | 'right') => (
    <section class={`comparison-panel u-card ${key}`} data-compare-side={key}>
      <h2 class="comparison-label" {...textCheck(`${key}.label`, 20)}>
        {side.label}
      </h2>
      {side.summary ? (
        <p class="comparison-summary" {...textCheck(`${key}.summary`, 48)}>
          {side.summary}
        </p>
      ) : null}
      <ScoreBlock score={side.score} path={key} />
      <ul class="comparison-points">
        {side.points.map((point, index) => (
          <li data-part {...textCheck(`${key}.points[${index}]`, 38)}>
            {point}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div class="slide-inner">
      <SlideHeader slide={slide} index={props.index} />
      <div class="slide-body" {...animationAttributes(slide, 'balance')}>
        <div class="comparison-grid">
          {renderSide(slide.left, 'left')}
          {renderSide(slide.right, 'right')}
        </div>
        {slide.verdict ? (
          <div class="verdict-strip" {...textCheck('verdict', 58)}>
            {slide.verdict}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CausalTemplate(props: { slide: CausalSlide; index: number }) {
  const { slide } = props;
  return (
    <div class="slide-inner">
      <SlideHeader slide={slide} index={props.index} />
      <div class="slide-body" {...animationAttributes(slide, 'data-flow')}>
        <div class="causal-flow">
          <section class="causal-box u-card u-flow-node">
            <div class="causal-label">CAUSE</div>
            <p class="causal-text" {...textCheck('cause', 48)}>
              {slide.cause}
            </p>
          </section>
          <div class="causal-mechanism">
            <div class="causal-arrow u-flow-arrow">→</div>
            {slide.mechanism.map((item, index) => (
              <div class="mechanism-item u-flow-node" {...textCheck(`mechanism[${index}]`, 32)}>
                {item}
              </div>
            ))}
            <div class="causal-arrow u-flow-arrow">→</div>
          </div>
          <section class="causal-box u-card u-flow-node">
            <div class="causal-label">EFFECT</div>
            <p class="causal-text" {...textCheck('effect', 48)}>
              {slide.effect}
            </p>
          </section>
        </div>
        {slide.implication ? (
          <div class="implication-strip" {...textCheck('implication', 58)}>
            {slide.implication}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProcessTemplate(props: { slide: ProcessSlide; index: number }) {
  const { slide } = props;
  return (
    <div class="slide-inner">
      <SlideHeader slide={slide} index={props.index} />
      <div class="slide-body" {...animationAttributes(slide, 'step-in')}>
        <div class="process-steps" style={`--step-count:${slide.steps.length}`}>
          {slide.steps.map((step, index) => (
            <section class="process-step u-step u-card">
              <div class="step-index">{index + 1}</div>
              <h2 class="step-title" {...textCheck(`steps[${index}].title`, 22)}>
                {step.title}
              </h2>
              {step.description ? (
                <p class="step-description" {...textCheck(`steps[${index}].description`, 42)}>
                  {step.description}
                </p>
              ) : null}
            </section>
          ))}
        </div>
        {slide.outcome ? (
          <div class="outcome-strip" {...textCheck('outcome', 58)}>
            {slide.outcome}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ListTemplate(props: { slide: ListSlide; index: number }) {
  const { slide } = props;
  return (
    <div class="slide-inner">
      <SlideHeader slide={slide} index={props.index} />
      <div class="slide-body" {...animationAttributes(slide, 'assemble')}>
        <div class={`list-grid count-${slide.items.length}`}>
          {slide.items.map((item, index) => (
            <section class="list-item u-card u-part" data-part>
              <h2 class="list-item-title" {...textCheck(`items[${index}].title`, 24)}>
                {item.title}
              </h2>
              {item.description ? (
                <p class="list-item-description" {...textCheck(`items[${index}].description`, 48)}>
                  {item.description}
                </p>
              ) : null}
            </section>
          ))}
        </div>
        {slide.takeaway ? (
          <div class="takeaway-strip" {...textCheck('takeaway', 58)}>
            {slide.takeaway}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CustomTemplate(props: { slide: CustomSlide; index: number }) {
  const { slide } = props;
  return (
    <div class="slide-inner">
      <SlideHeader slide={slide} index={props.index} title={slide.title ?? '自由HTML'} />
      <div class="slide-body custom-frame" {...animationAttributes(slide, 'fade-rise')}>
        <div dangerouslySetInnerHTML={{ __html: slide.html }} />
      </div>
    </div>
  );
}

export function SlideTemplate(props: { slide: Exclude<Slide, { type: 'chart' }>; index: number }) {
  switch (props.slide.type) {
    case 'conclusion':
      return <ConclusionTemplate slide={props.slide} index={props.index} />;
    case 'comparison':
      return <ComparisonTemplate slide={props.slide} index={props.index} />;
    case 'causal':
      return <CausalTemplate slide={props.slide} index={props.index} />;
    case 'process':
      return <ProcessTemplate slide={props.slide} index={props.index} />;
    case 'list':
      return <ListTemplate slide={props.slide} index={props.index} />;
    case 'custom':
      return <CustomTemplate slide={props.slide} index={props.index} />;
  }
}
