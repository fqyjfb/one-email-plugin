/**
 * codePrivacy 回归测试：移植自 daozai src/mail_privacy.rs。
 * 运行：node src/utils/codePrivacy.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskCode, parseExplicitLifetime } from './codePrivacy.ts';

test('masking_covers_normalized_code_variants', () => {
  const cases: [string, string, string][] = [
    ['验证码 １２３４５６', '123456', '验证码 ••••••'],
    ['验证码 12\u200b3456', '123456', '验证码 ••••••'],
    ['验证码 123456', '123 456', '验证码 ••••••'],
    ['验证码 ＡＢＣ－１２３', 'ABC-123', '验证码 ••••••'],
  ];
  for (const [text, code, expected] of cases) {
    assert.equal(maskCode(text, code), expected, `归一化变体必须遮住：text=${text} code=${code}`);
  }
});

test('fallback_masks_formatted_codes', () => {
  assert.ok(!maskCode('123456 and 1 2 3-4 5 6', '123456').includes('1'));
});

test('explicit_lifetime_requires_code_context_and_unambiguous_duration', () => {
  assert.equal(parseExplicitLifetime('验证码 123456 有效期为30秒', '', '123456'), 30);
  assert.equal(parseExplicitLifetime('', 'Your verification code 123456 is valid for 5 minutes.', '123456'), 300);
  assert.equal(parseExplicitLifetime('验证码 123456', '会员有效期30分钟', '123456'), null);
  assert.equal(parseExplicitLifetime('验证码 123456，会员有效期30分钟', '', '123456'), null);
  assert.equal(parseExplicitLifetime('验证码 123456 有效期为30秒，有效期为5分钟', '', '123456'), null);
  assert.equal(parseExplicitLifetime('验证码 123456 有效期999小时', '', '123456'), null);
});

test('mask_without_code_returns_text', () => {
  assert.equal(maskCode('hello world', ''), 'hello world');
});
