/**
 * otp.ts 回归测试：移植自 daozai src/otp.rs 的全部正/负向用例。
 * 运行：node src/utils/otp.test.ts（Node 22+ 原生 strip-types）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractOtp, htmlToText, extractEmphasized } from './otp.ts';

function code(subject: string, body: string): string | null {
  const c = extractOtp(subject, body, []);
  return c ? c.text : null;
}

test('numeric_html_entities_still_produce_a_maskable_code', () => {
  const body = htmlToText('<p>验证码：&#49;&#50;&#51;&#52;&#53;&#54;</p>');
  const first = extractOtp('', body, []);
  assert.ok(first, '应当提取到验证码 123456');
  assert.equal(first.text, '123456');
});

test('alphabetic_codes_require_an_explicit_code_field', () => {
  const cases: [string, string, string][] = [
    ['Your verification code', 'Your verification code: QXTRPA', 'QXTRPA'],
    ['Your security code', 'Your security code: qmxrpt.', 'qmxrpt'],
    ['', 'Your verification code is QxTrPa.', 'QxTrPa'],
    ['', '验证码为：AbCdEf。', 'AbCdEf'],
    ['', '您的一次性驗證碼為：QXTRPA', 'QXTRPA'],
    ['Sign-in', 'One-time code:\nQXTRPA\nExpires in 5 minutes.', 'QXTRPA'],
    ['', 'OTP:\nABCD-EFGH', 'ABCD-EFGH'],
    ['', 'Verification code\n\nQXTRPA\n', 'QXTRPA'],
  ];
  for (const [subject, body, expected] of cases) {
    assert.equal(code(subject, body), expected, body);
  }
});

test('alphabetic_codes_reject_regular_words_and_non_authentication_fields', () => {
  const cases: [string, string][] = [
    ['Verification code', 'Your verification code will arrive soon.'],
    ['Verification code', 'Thanks'],
    ['', 'Your verification code is valid.'],
    ['', 'Your verification code is ready.'],
    ['', 'Your verification code is useful.'],
    ['', 'Your verification code is SECURE.'],
    ['', 'Verification code: Action Required'],
    ['', 'Verification code:\nCOPY'],
    ['', 'Verification code: NEXT'],
    ['', 'Your verification code is NORMAL.'],
    ['', 'Verification code: PLEASE ENTER THE CODE.'],
    ['', 'Please verify your email and click CONTINUE.'],
    ['', 'CODE: GITHUB'],
    ['', 'Source code: SAMPLE'],
    ['', 'Your promo code: SUMMER'],
    ['', 'Verification code: SUMMER. Enjoy a discount.'],
    ['', 'Verification code: https://example.com/QXTRPA'],
    ['', 'Verification code: QXTRPA@example.com'],
    ['', 'Verification code: QXTRPA.com'],
    ['', 'Verification code: abcdefghijkl'],
    ['', 'Verification code: ABC'],
  ];
  for (const [subject, body] of cases) {
    assert.equal(code(subject, body), null, `普通英文不能被放大成验证码：${body}`);
  }
  const body = htmlToText('<h1>Account verification</h1><p><b>WELCOME</b></p><p>Please sign in.</p>');
  assert.equal(
    extractOtp('Verification code', body, ['WELCOME']),
    null,
    '标题和加粗单词不能单独证明这是验证码',
  );
});

test('alphabetic_codes_do_not_guess_between_distinct_values', () => {
  assert.equal(code('', 'Verification code: QXTRPA\nSecurity code: JZKWRT'), null);
  assert.equal(code('', 'Verification code: QXTRPA\nSecurity code: QXTRPA'), 'QXTRPA');
  assert.equal(code('', 'Verification code: QXTRPA\nVerification code: 123456'), '123456');
});

test('regression_traditional_verification_codes', () => {
  const body =
    '我們收到您要申請一次性驗證碼來與 Microsoft 帳戶搭配使用。\n您的一次性驗證碼為：431872\n僅在官方網站或應用程式上輸入此代碼。不要與任何人分享。';
  assert.equal(code('您的一次性驗證碼', body), '431872');
  const cases: [string, string, string][] = [
    ['登入驗證碼', '您的一次性驗證碼為：4318729', '4318729'],
    ['', '您的驗證碼為 431872，請勿分享。', '431872'],
    ['', '您的動態密碼：482913，5 分鐘內有效。', '482913'],
  ];
  for (const [subject, body2, expected] of cases) {
    assert.equal(code(subject, body2), expected, body2);
  }
  const reject = [
    '驗證碼通知：訂單號 431872 已出貨',
    '驗證碼通知：電話 431872',
    '驗證碼通知：金額 431872',
    '驗證碼請見圖片',
  ];
  for (const b of reject) {
    assert.equal(code('', b), null, `不能把普通数字当成验证码：${b}`);
  }
});

test('chinese_codes_with_strong_keyword', () => {
  assert.equal(code('【某某】验证码', '您的验证码是：834921，10分钟内有效。'), '834921');
  assert.equal(code('', '动态密码：482913（5分钟内有效）'), '482913');
  assert.equal(code('', '验证码 906213'), '906213');
  assert.equal(code('', '安全码：4021'), '4021');
  assert.equal(code('', '验证码\n735164\n请勿泄露'), '735164');
});

test('unicode_whitespace_before_code_is_safe', () => {
  const spaces = ['\u00a0', '\u2002', '\u2003', '\u202f', '\u3000'];
  for (const sp of spaces) {
    const text = `验证码：${sp}834921`;
    assert.equal(code('', text), '834921');
    assert.equal(code(text, ''), '834921');
    assert.equal(code('', `验证码：${sp}https://example.com/834921`), null);
  }
});

test('english_and_mixed_alnum_codes', () => {
  assert.equal(
    code('Your verification code', 'Your verification code is 552310. It expires in 10 minutes.'),
    '552310',
  );
  assert.equal(code('', '验证码：A1B2C3'), 'A1B2C3');
  assert.equal(code('验证码 K7Q2-9XMP', '10 分钟内有效'), 'K7Q2-9XMP');
});

test('full_width_digits_are_normalized', () => {
  assert.equal(code('', '您的验证码是：８３４９２１，10分钟内有效'), '834921');
});

test('emphasized_html_without_nearby_keyword', () => {
  const html = '<p>尊敬的用户，您正在进行登录操作。</p><p>本次校验：<b>834921</b></p>';
  const body = htmlToText(html);
  const emph = extractEmphasized(html);
  const got = extractOtp('', body, emph);
  assert.ok(got, '强调片段应帮助提取到验证码');
  assert.equal(got.text, '834921');
});

test('negatives_are_rejected', () => {
  const cases: [string, string][] = [
    ['', '您的订单号 12345678 已发货'],
    ['', '订单 482913，金额 ￥1,299.00'],
    ['', '会议号 123 456 789'],
    ['', '2026年10月30日 13:20 开始'],
    ['', '客服电话 400-800-8888'],
    ['', '优惠券码 SAVE20，立减 20 元'],
    ['', 'https://example.com/verify/482913'],
    ['', '卡尾号 8891'],
    ['', '邮编 200120'],
    ['', '验证码有效期至 2026-10-30'],
    ['', '产品型号 SKU-8891 已出库'],
    ['', '验证码请见图片'],
    ['', '您的快递 773456789012 已到驿站'],
    ['', '验证码：请在邮箱中查看'],
  ];
  for (const [subject, body] of cases) {
    assert.equal(code(subject, body), null, `should reject: ${body}`);
  }
});

test('order_number_does_not_beat_real_code', () => {
  assert.equal(code('', '验证码：834921，如非本人操作请忽略。订单号 987654'), '834921');
});

test('html_to_text_strips_tags_and_entities', () => {
  const text = htmlToText('<div>验证码&nbsp;123456</div><script>var x=1</script>');
  assert.ok(text.indexOf('验证码 123456') !== -1);
  assert.ok(text.indexOf('var x') === -1);
});
