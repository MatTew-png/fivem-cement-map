import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, isImageIconString, sanitizeIconUrl } from '../src/utils/html.ts';

test('escapeHtml neutralizes HTML injection vectors', () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('xss')">&copy;`),
    '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp;copy;'
  );
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
});

test('sanitizeIconUrl permits safe asset paths and HTTPS URLs while blocking dangerous URIs', () => {
  assert.equal(sanitizeIconUrl('/blips/radar_contraband.png'), '/blips/radar_contraband.png');
  assert.equal(sanitizeIconUrl('https://cdn.example.com/icon.png'), 'https://cdn.example.com/icon.png');

  assert.equal(sanitizeIconUrl('javascript:alert(1)'), '/blips/radar_player_king_white.png');
  assert.equal(sanitizeIconUrl('data:text/html,<script>alert(1)</script>'), '/blips/radar_player_king_white.png');
  assert.equal(sanitizeIconUrl('/blips/x.png" onerror="alert(1)'), '/blips/radar_player_king_white.png');
  assert.equal(sanitizeIconUrl(''), '/blips/radar_player_king_white.png');
});

test('isImageIconString differentiates image paths/URLs from emojis', () => {
  assert.equal(isImageIconString('/blips/radar_cement.png'), true);
  assert.equal(isImageIconString('https://example.com/a.png'), true);
  assert.equal(isImageIconString('🧱'), false);
  assert.equal(isImageIconString(null), false);
});
