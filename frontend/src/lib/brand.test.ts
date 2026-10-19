import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('serves a self-contained, vector-only Hyperloop symbol',()=>{
  const source=readFileSync('src/app/icon.svg','utf8');
  const document=new DOMParser().parseFromString(source,'image/svg+xml');
  expect(document.querySelector('parsererror')).toBeNull();
  expect(document.querySelector('svg')?.getAttribute('viewBox')).toBeTruthy();
  expect(document.querySelectorAll('path, rect, circle, polygon, ellipse').length).toBeGreaterThan(0);
  expect(document.querySelector('text, script, image, foreignObject')).toBeNull();
  expect(document.querySelector('[href], [xlink\\:href]')).toBeNull();
});
