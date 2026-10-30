import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { GroupFields } from './GroupFields';
it('выводит ровно пять однострочных полей участников', () => {
  const html = renderToStaticMarkup(<GroupFields value="Анна" onChange={() => {}} />);
  expect(html.match(/<input/g)).toHaveLength(5);
  for (let index = 1; index <= 5; index++) expect(html).toContain(`aria-label="Участник группы ${index}"`);
  expect(html).toContain('Анна');
});
