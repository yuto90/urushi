import { createChartPlayer } from './chart-player.js';

export const deckRuntimeJs = `
(function () {
  var WIDTH = 1920;
  var HEIGHT = 1080;
  var deck = document.querySelector('.urushi-deck');
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var footer = document.querySelector('.deck-footer');
  var current = 0;
  var params = new URLSearchParams(window.location.search);
  var staticMode = params.has('static') || params.has('print');
  var chartPlayer = (${createChartPlayer.toString()})(slides, window.gsap, params.has('print'));
  var specs = window.__URUSHI_ANIMATIONS__ || {};

  if (params.has('print')) document.documentElement.classList.add('print-mode');

  function scaleDeck() {
    if (!deck || params.has('print')) return;
    var scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    deck.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
  }

  function numberText() {
    return (current + 1) + ' / ' + slides.length;
  }

  function updateFooter() {
    if (footer) footer.textContent = numberText();
  }

  function numericParams(el) {
    var out = {};
    var raw = el.getAttribute('data-anim-params');
    if (!raw) return out;
    try {
      var parsed = JSON.parse(raw);
      Object.keys(parsed || {}).forEach(function (key) {
        if (typeof parsed[key] === 'number') out[key] = parsed[key];
      });
    } catch (_) {}
    return out;
  }

  function childrenOf(el, selector) {
    var found = Array.prototype.slice.call(el.querySelectorAll(selector));
    if (el.matches(selector)) found.unshift(el);
    return found;
  }

  function animateGeneric(el, spec, params) {
    if (!window.gsap || !spec.intro || !spec.final) return;
    var targets = spec.target === 'children' ? Array.prototype.slice.call(el.children) : [el];
    if (!targets.length) targets = [el];
    var intro = Object.assign({}, spec.intro);
    if (typeof params.distance === 'number' && typeof intro.y === 'number') intro.y = params.distance;
    var final = Object.assign({}, spec.final, { duration: spec.duration, stagger: params.stagger || 0.08, ease: 'power2.out', overwrite: true });
    window.gsap.fromTo(targets, intro, final);
  }

  function animateElement(el) {
    if (!window.gsap) return;
    var name = el.getAttribute('data-anim');
    if (!name) return;
    var spec = specs[name];
    if (!spec) return;
    var params = numericParams(el);
    var duration = spec.duration || 0.7;
    var stagger = typeof params.stagger === 'number' ? params.stagger : 0.12;
    var distance = typeof params.distance === 'number' ? params.distance : 48;

    if (spec.effect === 'assemble') {
      var parts = childrenOf(el, '[data-part], .u-part');
      window.gsap.fromTo(parts, { opacity: 0, y: distance, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: duration, stagger: stagger, ease: 'power3.out', overwrite: true });
      return;
    }
    if (spec.effect === 'steps') {
      var steps = childrenOf(el, '.u-step, .u-part');
      if (!steps.length) steps = Array.prototype.slice.call(el.children);
      window.gsap.fromTo(steps, { opacity: 0, x: -distance }, { opacity: 1, x: 0, duration: duration, stagger: stagger, ease: 'power2.out', overwrite: true });
      return;
    }
    if (spec.effect === 'bar') {
      var bars = childrenOf(el, '.u-bar');
      bars.forEach(function (bar, index) {
        var finalWidth = bar.style.getPropertyValue('--bar-value') || ((bar.getAttribute('data-value') || '0') + '%');
        window.gsap.fromTo(bar, { width: '0%' }, { width: finalWidth, duration: duration, delay: index * stagger, ease: 'power3.out', overwrite: true });
      });
    }
    if (spec.effect === 'count' || spec.effect === 'bar') {
      var counts = childrenOf(el, '.u-count');
      counts.forEach(function (node, index) {
        var value = Number(node.getAttribute('data-value') || node.textContent || '0');
        var state = { value: 0 };
        window.gsap.to(state, { value: value, duration: duration + 0.2, delay: index * stagger, ease: 'power2.out', overwrite: true, onUpdate: function () {
          node.textContent = String(Math.round(state.value));
        }, onComplete: function () { node.textContent = String(Math.round(value)); } });
      });
      return;
    }
    if (spec.effect === 'morph') {
      var panels = childrenOf(el, '[data-compare-side], .comparison-panel');
      panels.forEach(function (panel, index) {
        var direction = index % 2 === 0 ? -1 : 1;
        window.gsap.fromTo(panel, { opacity: 0, x: direction * distance, scale: 0.97 }, { opacity: 1, x: 0, scale: 1, duration: duration, delay: index * stagger, ease: 'power3.out', overwrite: true });
      });
      return;
    }
    if (spec.effect === 'balance') {
      var sides = childrenOf(el, '[data-compare-side], .comparison-panel');
      sides.forEach(function (panel, index) {
        var direction = index % 2 === 0 ? -1 : 1;
        window.gsap.fromTo(panel, { opacity: 0, x: direction * distance, rotate: direction * 1.5 }, { opacity: 1, x: 0, rotate: 0, duration: duration, delay: index * stagger, ease: 'back.out(1.2)', overwrite: true });
      });
      return;
    }
    if (spec.effect === 'flow') {
      var nodes = childrenOf(el, '.u-flow-node');
      var arrows = childrenOf(el, '.u-flow-arrow');
      window.gsap.fromTo(nodes, { opacity: 0, x: -distance }, { opacity: 1, x: 0, duration: duration, stagger: stagger, ease: 'power2.out', overwrite: true });
      window.gsap.fromTo(arrows, { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: duration * 0.7, stagger: stagger, ease: 'power2.out', overwrite: true });
      return;
    }
    animateGeneric(el, spec, params);
  }

  function playSlide(slide) {
    if (staticMode || !slide) return;
    Array.prototype.slice.call(slide.querySelectorAll('[data-anim]')).forEach(animateElement);
  }

  function go(index, options) {
    if (!slides.length) return;
    var previous = current;
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach(function (slide, slideIndex) {
      slide.classList.toggle('active', slideIndex === current);
    });
    chartPlayer(previous, current, !staticMode && (!options || options.animate !== false));
    updateFooter();
    if (window.parent !== window) window.parent.postMessage({ type: 'urushi:slide', index: current }, '*');
    if (!options || options.animate !== false) playSlide(slides[current]);
    if (!options || options.hash !== false) {
      try { history.replaceState(null, '', '#/' + (current + 1)); } catch (_) {}
    }
  }

  function next() { if (current + 1 < slides.length) go(current + 1); }
  function prev() { go(current - 1); }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown') { event.preventDefault(); next(); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); prev(); }
    if (event.key === 'Home') { event.preventDefault(); go(0); }
    if (event.key === 'End') { event.preventDefault(); go(slides.length - 1); }
  });
  document.addEventListener('click', function (event) {
    if (params.has('print')) return;
    var x = event.clientX || 0;
    if (x > window.innerWidth * 0.72) next();
  });
  window.addEventListener('resize', scaleDeck);
  window.addEventListener('message', function (event) {
    if (window === window.parent || event.source !== window.parent || !event.data || !Number.isInteger(event.data.index)) return;
    var index = event.data.index;
    if (event.data.type === 'urushi:advance') go(index, { hash: false });
    if (event.data.type === 'urushi:seek') go(index, { animate: false, hash: false });
    if (event.data.type === 'urushi:replay' && index > 0 && index < slides.length) {
      go(index - 1, { animate: false, hash: false });
      go(index, { hash: false });
    }
  });

  window.__urushi = {
    go: go,
    next: next,
    prev: prev,
    count: function () { return slides.length; },
    setStaticMode: function (value) { staticMode = !!value; },
    playCurrent: function () { playSlide(slides[current]); }
  };

  scaleDeck();
  var initial = 0;
  if (window.location.hash.indexOf('#/') === 0) {
    var slideNumber = Number(window.location.hash.slice(2));
    if (slideNumber >= 1) initial = slideNumber - 1;
  }
  go(initial, { hash: false, animate: false });
  if (!staticMode) window.requestAnimationFrame(function () { playSlide(slides[current]); });
})();
`;
