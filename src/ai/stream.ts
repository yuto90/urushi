import { parseDeckYaml, type Deck } from '../schema/index.js';
import { extractYamlText } from './extract.js';

// A block-style sequence entry is complete when its next sibling starts, even if a
// scalar inside the entry spans lines. Never render a parseable but unfinished tail.
export class SlideStream {
  private text = '';
  private cursor = 0;
  private inSlides = false;
  private indent?: number;
  private count = 0;

  constructor(private readonly preview: (deck: Deck) => void) {}

  push(chunk: string) {
    this.text += chunk;
    let newline: number;
    while ((newline = this.text.indexOf('\n', this.cursor)) >= 0) {
      const line = this.text.slice(this.cursor, newline).trimEnd();
      if (/^slides:\s*(?:#.*)?$/.test(line)) this.inSlides = true;
      else if (this.inSlides) {
        const entry = /^( *)-(?:\s|$)/.exec(line);
        if (entry) {
          if (this.indent === undefined) this.indent = entry[1].length;
          else if (entry[1].length === this.indent) this.emit(this.text.slice(0, this.cursor));
        } else if (/^\S/.test(line) && !line.startsWith('#')) {
          this.emit(this.text.slice(0, this.cursor));
          this.inSlides = false;
        }
      }
      this.cursor = newline + 1;
    }
  }

  finish(yaml: string) { this.emit(yaml); }

  private emit(text: string) {
    const result = parseDeckYaml(extractYamlText(text));
    if (result.ok && result.deck.slides.length > this.count) {
      this.count = result.deck.slides.length;
      this.preview(result.deck);
    }
  }
}
