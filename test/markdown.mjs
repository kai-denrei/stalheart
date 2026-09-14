import assert from 'node:assert/strict';
import { markdown, escapeHtml } from '../src/core/markdown.js';

assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
assert.equal(markdown('# Title'), '<h1>Title</h1>');
assert.equal(markdown('### Deep'), '<h3>Deep</h3>');
assert.equal(markdown('```\n<div>\n```'), '<pre><code>&lt;div&gt;</code></pre>', 'a fence stays visible, never becomes markup');
assert.equal(markdown('- a\n- b'), '<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
assert.equal(markdown('1. a\n2. b'), '<ol>\n<li>a</li>\n<li>b</li>\n</ol>');
assert.equal(markdown('a `c` **b** *e* ~~d~~ [l](u)'),
  '<p>a <code>c</code> <strong>b</strong> <em>e</em> <del>d</del> <a href="u" rel="noreferrer">l</a></p>');
assert.equal(markdown('| a | b |\n|---|---|\n| 1 | 2 |'),
  '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
assert.equal(markdown('> q'), '<blockquote>q</blockquote>');
assert.equal(markdown('---'), '<hr>');
assert.equal(markdown('line one\nline two'), '<p>line one line two</p>');
assert.equal(markdown('<b>x</b> & "q"'), '<p>&lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot;</p>', 'escaping runs before inline');
console.log('Markdown: headings, fences, lists, inline, tables, quotes, rules and escaping pinned.');
