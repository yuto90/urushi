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
};

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
          <h1 class="slide-title" data-check-text data-check-path="title">
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
        <p class="conclusion-statement u-part" data-part data-check-text data-check-path="conclusion">
          {slide.conclusion}
        </p>
        {slide.evidence?.length ? (
          <div class="conclusion-evidence">
            {slide.evidence.map((item, index) => (
              <div class="evidence-chip u-part" data-part data-check-text data-check-path={`evidence[${index}]`}>
                {item}
              </div>
            ))}
          </div>
        ) : null}
        {slide.callToAction ? (
          <div class="call-to-action u-part" data-part data-check-text data-check-path="callToAction">
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
      <span class="score-number u-count" data-value={score} data-check-text data-check-path={`${props.path}.score`}>
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
      <h2 class="comparison-label" data-check-text data-check-path={`${key}.label`}>
        {side.label}
      </h2>
      {side.summary ? (
        <p class="comparison-summary" data-check-text data-check-path={`${key}.summary`}>
          {side.summary}
        </p>
      ) : null}
      <ScoreBlock score={side.score} path={key} />
      <ul class="comparison-points">
        {side.points.map((point, index) => (
          <li data-part data-check-text data-check-path={`${key}.points[${index}]`}>
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
          <div class="verdict-strip" data-check-text data-check-path="verdict">
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
            <p class="causal-text" data-check-text data-check-path="cause">
              {slide.cause}
            </p>
          </section>
          <div class="causal-mechanism">
            <div class="causal-arrow u-flow-arrow">→</div>
            {slide.mechanism.map((item, index) => (
              <div class="mechanism-item u-flow-node" data-check-text data-check-path={`mechanism[${index}]`}>
                {item}
              </div>
            ))}
            <div class="causal-arrow u-flow-arrow">→</div>
          </div>
          <section class="causal-box u-card u-flow-node">
            <div class="causal-label">EFFECT</div>
            <p class="causal-text" data-check-text data-check-path="effect">
              {slide.effect}
            </p>
          </section>
        </div>
        {slide.implication ? (
          <div class="implication-strip" data-check-text data-check-path="implication">
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
              <h2 class="step-title" data-check-text data-check-path={`steps[${index}].title`}>
                {step.title}
              </h2>
              {step.description ? (
                <p class="step-description" data-check-text data-check-path={`steps[${index}].description`}>
                  {step.description}
                </p>
              ) : null}
            </section>
          ))}
        </div>
        {slide.outcome ? (
          <div class="outcome-strip" data-check-text data-check-path="outcome">
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
              <h2 class="list-item-title" data-check-text data-check-path={`items[${index}].title`}>
                {item.title}
              </h2>
              {item.description ? (
                <p class="list-item-description" data-check-text data-check-path={`items[${index}].description`}>
                  {item.description}
                </p>
              ) : null}
            </section>
          ))}
        </div>
        {slide.takeaway ? (
          <div class="takeaway-strip" data-check-text data-check-path="takeaway">
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

export function SlideTemplate(props: { slide: Slide; index: number }) {
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
