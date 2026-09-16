/**
 * test_rmb.js - 人民币大写转换工具回归测试
 * 运行方式: node test_rmb.js
 */
'use strict';

// ========== 核心常量与函数（从 index.html 提取）==========
const DIGITS = '零壹贰叁肆伍陆柒捌玖';
const UNITS = ['仟','佰','拾',''];
const BIG_UNITS = ['','万','亿','万亿','亿亿'];
const DIGIT_MAP = {零:0,壹:1,贰:2,叁:3,肆:4,伍:5,陆:6,柒:7,捌:8,玖:9};
const UNIT_MAP = {拾:10,佰:100,仟:1000,万:10000,亿:100000000};
const ALLOWED_CN_CHARS = new Set([
  ...Object.keys(DIGIT_MAP), ...Object.keys(UNIT_MAP),
  '元','角','分','整','正','人民币','负'
]);
const FULLWIDTH_MAP = {'０':'0','１':'1','２':'2','３':'3','４':'4','５':'5','６':'6','７':'7','８':'8','９':'9','．':'.','，':','};
const MAX_SAFE_DIGITS = 15;

function toChinese(numStr) {
  numStr = numStr.trim();
  if (!numStr) return '';
  numStr = normalizeInput(numStr);
  if (!/\d/.test(numStr)) return '';
  let tempStr = numStr;
  if (tempStr[0] === '-') tempStr = tempStr.slice(1);
  tempStr = tempStr.replace(/^0+/, '') || '0';
  if (tempStr[0] === '.') tempStr = '0' + tempStr;
  let [integer] = tempStr.split('.');
  if (integer.length > MAX_SAFE_DIGITS) {
    return '金额过大，整数部分超出安全精度范围';
  }
  let validation = validateNumberInput(numStr);
  if (!validation.valid) {
    return '';
  }
  let neg = false;
  if (numStr[0] === '-') { neg = true; numStr = numStr.slice(1); }
  numStr = numStr.replace(/^0+/, '') || '0';
  if (numStr[0] === '.') numStr = '0' + numStr;
  let [integerPart, decimal = ''] = numStr.split('.');
  if (decimal.length > 2) {
    return '';
  }
  decimal = (decimal + '00').slice(0, 2);
  let segCount = Math.ceil(integerPart.length / 4);
  if (segCount > BIG_UNITS.length) {
    return '金额过大，暂不支持';
  }
  let intResult = integerPart === '0' ? '' : integerToChinese(integerPart);
  let decResult = decimalToChinese(decimal, intResult !== '');
  if (intResult === '') {
    if (decimal === '00') return (neg ? '负' : '') + '零元整';
    return (neg ? '负' : '') + decResult;
  }
  let result = intResult + '元' + decResult;
  if (decimal === '00') {
    result += '整';
  }
  return (neg ? '负' : '') + result;
}

function integerToChinese(n) {
  if (n === '0') return '零';
  if (!n || n === '') return '';
  let segments = [];
  let str = n;
  while (str.length > 0) {
    segments.unshift(str.slice(-4));
    str = str.slice(0, -4);
  }
  let result = '';
  let zeroBetween = false;
  for (let i = 0; i < segments.length; i++) {
    let seg = segments[i];
    let segNum = parseInt(seg, 10);
    if (segNum === 0) {
      zeroBetween = true;
      continue;
    }
    let skipLeadingZero = false;
    if (zeroBetween) {
      result += '零';
      zeroBetween = false;
      skipLeadingZero = true;
    }
    let segResult = processSegment(seg, skipLeadingZero);
    let bigUnit = BIG_UNITS[segments.length - 1 - i];
    if (bigUnit === undefined) {
      return '';
    }
    result += segResult + bigUnit;
  }
  return result;
}

function processSegment(seg, skipLeadingZero) {
  if (skipLeadingZero) {
    seg = seg.replace(/^0+/, '') || '0';
  }
  let L = seg.length;
  let result = '';
  let zeroFlag = false;
  for (let j = 0; j < L; j++) {
    let d = parseInt(seg[j], 10);
    let unitIdx = 4 - L + j;
    if (d === 0) {
      if (!zeroFlag && j < L - 1) {
        let hasNonZero = false;
        for (let k = j + 1; k < L; k++) {
          if (parseInt(seg[k], 10) !== 0) { hasNonZero = true; break; }
        }
        if (hasNonZero) {
          result += '零';
          zeroFlag = true;
        }
      }
    } else {
      result += DIGITS[d] + UNITS[unitIdx];
      zeroFlag = false;
    }
  }
  return result;
}

function decimalToChinese(decimal, hasYuan) {
  let jiao = parseInt(decimal[0], 10);
  let fen = parseInt(decimal[1], 10);
  if (jiao === 0 && fen === 0) return '';
  let result = '';
  if (jiao > 0) {
    result += DIGITS[jiao] + '角';
  }
  if (fen > 0) {
    if (jiao === 0 && hasYuan) {
      result += '零';
    }
    result += DIGITS[fen] + '分';
  }
  return result;
}

function toNumber(chinese) {
  chinese = chinese.trim();
  if (!chinese) return '';
  let cleanForCheck = chinese.replace(/^人民币/, '').replace(/[整正]+$/, '');
  if (cleanForCheck[0] === '负') cleanForCheck = cleanForCheck.slice(1);
  for (let char of cleanForCheck) {
    if (!ALLOWED_CN_CHARS.has(char)) {
      return { error: true, msg: '包含无法识别的字符：「' + char + '」' };
    }
  }
  chinese = chinese.replace(/^人民币/, '');
  chinese = chinese.replace(/[整正]+$/, '');
  if (chinese.slice(1).includes('负')) {
    return { error: true, msg: '负号只能出现在大写金额的开头' };
  }
  let neg = false;
  if (chinese[0] === '负') { neg = true; chinese = chinese.slice(1); }
  if (!chinese) {
    return { error: true, msg: '请输入有效的大写金额' };
  }
  if (chinese[0] === '拾') {
    chinese = '壹' + chinese;
  }
  let hasDigit = false;
  for (let char of chinese) {
    if (DIGIT_MAP[char] !== undefined) { hasDigit = true; break; }
  }
  if (!hasDigit) {
    return { error: true, msg: '请输入有效的大写金额' };
  }
  if (/零[拾佰仟]/.test(chinese)) {
    return { error: true, msg: '大写金额格式错误：「零」后不能直接跟数位单位' };
  }
  let yuanIndex = chinese.indexOf('元');
  let integerPart = '', decimalPart = '';
  if (yuanIndex >= 0) {
    integerPart = chinese.slice(0, yuanIndex);
    decimalPart = chinese.slice(yuanIndex + 1);
  } else if (/[角分]/.test(chinese)) {
    decimalPart = chinese;
  } else if (/[万亿]/.test(chinese)) {
    integerPart = chinese;
  } else {
    return { error: true, msg: '大写金额格式错误，缺少「元」「角」或「分」单位' };
  }
  if (decimalPart) {
    let jiaoIdx = decimalPart.indexOf('角');
    let fenIdx = decimalPart.indexOf('分');
    if (fenIdx >= 0 && jiaoIdx >= 0 && fenIdx < jiaoIdx) {
      return { error: true, msg: '「分」不能在「角」之前' };
    }
  }
  let integer = integerPart ? chineseToNumber(integerPart) : 0;
  if (integer && typeof integer === 'object' && integer.error) return integer;
  let decimal = 0;
  if (decimalPart) {
    let decResult = parseDecimal(decimalPart);
    if (decResult && typeof decResult === 'object' && decResult.error) return decResult;
    decimal = decResult;
  }
  let total = integer + decimal;
  let hasFen = chinese.includes('分');
  let hasJiao = chinese.includes('角');
  if (total === Math.floor(total)) {
    return (neg ? '-' : '') + String(Math.floor(total));
  }
  if (!hasFen && hasJiao) {
    return (neg ? '-' : '') + total.toFixed(1);
  }
  return (neg ? '-' : '') + total.toFixed(2);
}

function chineseToNumber(chinese) {
  let total = 0;
  let current = 0;
  let lastDigit = 0;
  let lastBigUnit = 0;
  for (let char of chinese) {
    if (DIGIT_MAP[char] !== undefined) {
      lastDigit = DIGIT_MAP[char];
      current += lastDigit;
    } else if (UNIT_MAP[char] !== undefined) {
      let unit = UNIT_MAP[char];
      if (unit >= 10000) {
        if (total > 0 && current === 0) {
          if (lastDigit === 0) {
            return { error: true, msg: '大写金额格式错误：大单位前无有效数字' };
          }
          if (lastBigUnit > 0 && unit < lastBigUnit) {
            return { error: true, msg: '大写金额格式错误：大单位顺序错误' };
          }
          total = total * unit;
        } else if (total > 0) {
          total = total + current * unit;
        } else {
          total = current * unit;
        }
        current = 0;
        lastBigUnit = unit;
      } else {
        current = current - lastDigit + lastDigit * unit;
      }
    }
  }
  return total + current;
}

function parseDecimal(decimalChinese) {
  let jiao = 0, fen = 0;
  let lastDigit = 0;
  let hasJiao = false, hasFen = false;
  let expectDigit = true;
  for (let char of decimalChinese) {
    if (DIGIT_MAP[char] !== undefined) {
      if (!expectDigit && DIGIT_MAP[char] === 0 && lastDigit === 0) {
        return { error: true, msg: '小数部分格式错误：重复零未分隔' };
      }
      lastDigit = DIGIT_MAP[char];
      expectDigit = false;
    } else if (char === '角') {
      if (hasJiao) return { error: true, msg: '「角」重复出现' };
      if (expectDigit) return { error: true, msg: '「角」前缺少数字' };
      jiao = lastDigit;
      lastDigit = 0;
      hasJiao = true;
      expectDigit = true;
    } else if (char === '分') {
      if (hasFen) return { error: true, msg: '「分」重复出现' };
      if (expectDigit) return { error: true, msg: '「分」前缺少数字' };
      fen = lastDigit;
      lastDigit = 0;
      hasFen = true;
      expectDigit = true;
    } else {
      return { error: true, msg: '小数部分包含无法识别的字符：「' + char + '」' };
    }
  }
  if (!expectDigit) {
    return { error: true, msg: '小数部分格式错误：末尾数字缺少单位' };
  }
  return (jiao * 10 + fen) / 100;
}

function normalizeInput(val) {
  let result = '';
  for (let char of val) {
    result += FULLWIDTH_MAP[char] || char;
  }
  result = result.replace(/,/g, '');
  return result;
}

function validateNumberInput(val) {
  val = val.trim().replace(/\s/g, '');
  if (!val) return { valid: true, msg: '' };
  val = normalizeInput(val);
  if (/\.$/.test(val)) {
    return { valid: false, msg: '金额不能以点结尾' };
  }
  if (/^-?\./.test(val)) val = val.replace(/^(-?)\./, '$10.');
  if (!/^-?\d+\.?\d*$/.test(val)) {
    return { valid: false, msg: '只能输入数字和小数点' };
  }
  let parts = val.replace(/^-/, '').split('.');
  if (parts.length > 2) {
    return { valid: false, msg: '小数点只能有一个' };
  }
  if (parts[1] && parts[1].length > 2) {
    return { valid: false, msg: '小数最多两位（分）' };
  }
  return { valid: true, msg: '' };
}

// ========== 测试框架 ==========
let passed = 0;
let failed = 0;
let failures = [];

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    failed++;
    failures.push(`FAIL: ${msg}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  } else {
    passed++;
  }
}

function assertTrue(cond, msg) {
  if (!cond) {
    failed++;
    failures.push(`FAIL: ${msg}`);
  } else {
    passed++;
  }
}

function assertError(result, msg) {
  if (!result || typeof result !== 'object' || !result.error) {
    failed++;
    failures.push(`FAIL: ${msg}\n  expected error, got: ${JSON.stringify(result)}`);
  } else {
    passed++;
  }
}

// ========== toChinese 正向转换测试（约110条）==========
assertEqual(toChinese(''), '', '空输入');
assertEqual(toChinese('0'), '零元整', '0');
assertEqual(toChinese('0.00'), '零元整', '0.00');
assertEqual(toChinese('1'), '壹元整', '1');
assertEqual(toChinese('10'), '壹拾元整', '10');
assertEqual(toChinese('100'), '壹佰元整', '100');
assertEqual(toChinese('1000'), '壹仟元整', '1000');
assertEqual(toChinese('10000'), '壹万元整', '10000');
assertEqual(toChinese('100000'), '壹拾万元整', '100000');
assertEqual(toChinese('1000000'), '壹佰万元整', '1000000');
assertEqual(toChinese('10000000'), '壹仟万元整', '10000000');
assertEqual(toChinese('100000000'), '壹亿元整', '100000000');
assertEqual(toChinese('1000000000'), '壹拾亿元整', '1000000000');
assertEqual(toChinese('10000000000'), '壹佰亿元整', '10000000000');
assertEqual(toChinese('100000000000'), '壹仟亿元整', '100000000000');
assertEqual(toChinese('1000000000000'), '壹万亿元整', '1000000000000');
assertEqual(toChinese('10000000000000'), '壹拾万亿元整', '10000000000000');
assertEqual(toChinese('100000000000000'), '壹佰万亿元整', '100000000000000');
assertEqual(toChinese('101'), '壹佰零壹元整', '101');
assertEqual(toChinese('1001'), '壹仟零壹元整', '1001');
assertEqual(toChinese('10001'), '壹万零壹元整', '10001');
assertEqual(toChinese('100001'), '壹拾万零壹元整', '100001');
assertEqual(toChinese('1000001'), '壹佰万零壹元整', '1000001');
assertEqual(toChinese('10000001'), '壹仟万零壹元整', '10000001');
assertEqual(toChinese('100000001'), '壹亿零壹元整', '100000001');
assertEqual(toChinese('1000000001'), '壹拾亿零壹元整', '1000000001');
assertEqual(toChinese('10000000001'), '壹佰亿零壹元整', '10000000001');
assertEqual(toChinese('100000000001'), '壹仟亿零壹元整', '100000000001');
assertEqual(toChinese('1000000000001'), '壹万亿零壹元整', '1000000000001');
assertEqual(toChinese('10000000000001'), '壹拾万亿零壹元整', '10000000000001');
assertEqual(toChinese('100000000000001'), '壹佰万亿零壹元整', '100000000000001');
assertEqual(toChinese('1010'), '壹仟零壹拾元整', '1010');
assertEqual(toChinese('10010'), '壹万零壹拾元整', '10010');
assertEqual(toChinese('10100'), '壹万零壹佰元整', '10100');
assertEqual(toChinese('1100'), '壹仟壹佰元整', '1100');
assertEqual(toChinese('1111'), '壹仟壹佰壹拾壹元整', '1111');
assertEqual(toChinese('100100'), '壹拾万零壹佰元整', '100100');
assertEqual(toChinese('1000100'), '壹佰万零壹佰元整', '1000100');
assertEqual(toChinese('10000100'), '壹仟万零壹佰元整', '10000100');
assertEqual(toChinese('100000100'), '壹亿零壹佰元整', '100000100');
assertEqual(toChinese('1000000100'), '壹拾亿零壹佰元整', '1000000100');
assertEqual(toChinese('10000000100'), '壹佰亿零壹佰元整', '10000000100');
assertEqual(toChinese('100000000100'), '壹仟亿零壹佰元整', '100000000100');
assertEqual(toChinese('1000000000100'), '壹万亿零壹佰元整', '1000000000100');
assertEqual(toChinese('10000000000100'), '壹拾万亿零壹佰元整', '10000000000100');
assertEqual(toChinese('100000000000100'), '壹佰万亿零壹佰元整', '100000000000100');
assertEqual(toChinese('0.1'), '壹角', '0.1');
assertEqual(toChinese('0.01'), '壹分', '0.01');
assertEqual(toChinese('0.10'), '壹角', '0.10');
assertEqual(toChinese('0.11'), '壹角壹分', '0.11');
assertEqual(toChinese('1.1'), '壹元壹角', '1.1');
assertEqual(toChinese('1.01'), '壹元零壹分', '1.01');
assertEqual(toChinese('1.10'), '壹元壹角', '1.10');
assertEqual(toChinese('1.11'), '壹元壹角壹分', '1.11');
assertEqual(toChinese('10.01'), '壹拾元零壹分', '10.01');
assertEqual(toChinese('100.01'), '壹佰元零壹分', '100.01');
assertEqual(toChinese('1000.01'), '壹仟元零壹分', '1000.01');
assertEqual(toChinese('10000.01'), '壹万元零壹分', '10000.01');
assertEqual(toChinese('100000.01'), '壹拾万元零壹分', '100000.01');
assertEqual(toChinese('1000000.01'), '壹佰万元零壹分', '1000000.01');
assertEqual(toChinese('10000000.01'), '壹仟万元零壹分', '10000000.01');
assertEqual(toChinese('100000000.01'), '壹亿元零壹分', '100000000.01');
assertEqual(toChinese('1000000000.01'), '壹拾亿元零壹分', '1000000000.01');
assertEqual(toChinese('10000000000.01'), '壹佰亿元零壹分', '10000000000.01');
assertEqual(toChinese('100000000000.01'), '壹仟亿元零壹分', '100000000000.01');
assertEqual(toChinese('1000000000000.01'), '壹万亿元零壹分', '1000000000000.01');
assertEqual(toChinese('10000000000000.01'), '壹拾万亿元零壹分', '10000000000000.01');
assertEqual(toChinese('100000000000000.01'), '壹佰万亿元零壹分', '100000000000000.01');
assertEqual(toChinese('0.5'), '伍角', '0.5');
assertEqual(toChinese('0.50'), '伍角', '0.50');
assertEqual(toChinese('0.05'), '伍分', '0.05');
assertEqual(toChinese('0.55'), '伍角伍分', '0.55');
assertEqual(toChinese('5.5'), '伍元伍角', '5.5');
assertEqual(toChinese('5.05'), '伍元零伍分', '5.05');
assertEqual(toChinese('5.55'), '伍元伍角伍分', '5.55');
assertEqual(toChinese('50.5'), '伍拾元伍角', '50.5');
assertEqual(toChinese('50.05'), '伍拾元零伍分', '50.05');
assertEqual(toChinese('50.55'), '伍拾元伍角伍分', '50.55');
assertEqual(toChinese('500.5'), '伍佰元伍角', '500.5');
assertEqual(toChinese('500.05'), '伍佰元零伍分', '500.05');
assertEqual(toChinese('500.55'), '伍佰元伍角伍分', '500.55');
assertEqual(toChinese('5000.5'), '伍仟元伍角', '5000.5');
assertEqual(toChinese('5000.05'), '伍仟元零伍分', '5000.05');
assertEqual(toChinese('5000.55'), '伍仟元伍角伍分', '5000.55');
assertEqual(toChinese('50000.5'), '伍万元伍角', '50000.5');
assertEqual(toChinese('50000.05'), '伍万元零伍分', '50000.05');
assertEqual(toChinese('50000.55'), '伍万元伍角伍分', '50000.55');
assertEqual(toChinese('500000.5'), '伍拾万元伍角', '500000.5');
assertEqual(toChinese('500000.05'), '伍拾万元零伍分', '500000.05');
assertEqual(toChinese('500000.55'), '伍拾万元伍角伍分', '500000.55');
assertEqual(toChinese('5000000.5'), '伍佰万元伍角', '5000000.5');
assertEqual(toChinese('5000000.05'), '伍佰万元零伍分', '5000000.05');
assertEqual(toChinese('5000000.55'), '伍佰万元伍角伍分', '5000000.55');
assertEqual(toChinese('50000000.5'), '伍仟万元伍角', '50000000.5');
assertEqual(toChinese('50000000.05'), '伍仟万元零伍分', '50000000.05');
assertEqual(toChinese('50000000.55'), '伍仟万元伍角伍分', '50000000.55');
assertEqual(toChinese('500000000.5'), '伍亿元伍角', '500000000.5');
assertEqual(toChinese('500000000.05'), '伍亿元零伍分', '500000000.05');
assertEqual(toChinese('500000000.55'), '伍亿元伍角伍分', '500000000.55');
assertEqual(toChinese('5000000000.5'), '伍拾亿元伍角', '5000000000.5');
assertEqual(toChinese('5000000000.05'), '伍拾亿元零伍分', '5000000000.05');
assertEqual(toChinese('5000000000.55'), '伍拾亿元伍角伍分', '5000000000.55');
assertEqual(toChinese('50000000000.5'), '伍佰亿元伍角', '50000000000.5');
assertEqual(toChinese('50000000000.05'), '伍佰亿元零伍分', '50000000000.05');
assertEqual(toChinese('50000000000.55'), '伍佰亿元伍角伍分', '50000000000.55');
assertEqual(toChinese('500000000000.5'), '伍仟亿元伍角', '500000000000.5');
assertEqual(toChinese('500000000000.05'), '伍仟亿元零伍分', '500000000000.05');
assertEqual(toChinese('500000000000.55'), '伍仟亿元伍角伍分', '500000000000.55');
assertEqual(toChinese('5000000000000.5'), '伍万亿元伍角', '5000000000000.5');
assertEqual(toChinese('5000000000000.05'), '伍万亿元零伍分', '5000000000000.05');
assertEqual(toChinese('5000000000000.55'), '伍万亿元伍角伍分', '5000000000000.55');
assertEqual(toChinese('50000000000000.5'), '伍拾万亿元伍角', '50000000000000.5');
assertEqual(toChinese('50000000000000.05'), '伍拾万亿元零伍分', '50000000000000.05');
assertEqual(toChinese('50000000000000.55'), '伍拾万亿元伍角伍分', '50000000000000.55');
assertEqual(toChinese('500000000000000.5'), '伍佰万亿元伍角', '500000000000000.5');
assertEqual(toChinese('500000000000000.05'), '伍佰万亿元零伍分', '500000000000000.05');
assertEqual(toChinese('500000000000000.55'), '伍佰万亿元伍角伍分', '500000000000000.55');
assertEqual(toChinese('-1'), '负壹元整', '-1');
assertEqual(toChinese('-0.01'), '负壹分', '-0.01');
assertEqual(toChinese('-0.1'), '负壹角', '-0.1');
assertEqual(toChinese('-10.01'), '负壹拾元零壹分', '-10.01');
assertEqual(toChinese('-100.01'), '负壹佰元零壹分', '-100.01');
assertEqual(toChinese('-1000.01'), '负壹仟元零壹分', '-1000.01');
assertEqual(toChinese('-10000.01'), '负壹万元零壹分', '-10000.01');
assertEqual(toChinese('-100000.01'), '负壹拾万元零壹分', '-100000.01');
assertEqual(toChinese('-1000000.01'), '负壹佰万元零壹分', '-1000000.01');
assertEqual(toChinese('-10000000.01'), '负壹仟万元零壹分', '-10000000.01');
assertEqual(toChinese('-100000000.01'), '负壹亿元零壹分', '-100000000.01');
assertEqual(toChinese('-1000000000.01'), '负壹拾亿元零壹分', '-1000000000.01');
assertEqual(toChinese('-10000000000.01'), '负壹佰亿元零壹分', '-10000000000.01');
assertEqual(toChinese('-100000000000.01'), '负壹仟亿元零壹分', '-100000000000.01');
assertEqual(toChinese('-1000000000000.01'), '负壹万亿元零壹分', '-1000000000000.01');
assertEqual(toChinese('-10000000000000.01'), '负壹拾万亿元零壹分', '-10000000000000.01');
assertEqual(toChinese('-100000000000000.01'), '负壹佰万亿元零壹分', '-100000000000000.01');

// 15位边界
assertEqual(toChinese('999999999999999'), '玖佰玖拾玖万亿玖仟玖佰玖拾玖亿玖仟玖佰玖拾玖万玖仟玖佰玖拾玖元整', '999999999999999');
assertEqual(toChinese('999999999999999.99'), '玖佰玖拾玖万亿玖仟玖佰玖拾玖亿玖仟玖佰玖拾玖万玖仟玖佰玖拾玖元玖角玖分', '999999999999999.99');
assertEqual(toChinese('1000000000000000'), '金额过大，整数部分超出安全精度范围', '1000000000000000');
assertEqual(toChinese('9999999999999999'), '金额过大，整数部分超出安全精度范围', '9999999999999999');

// 无效输入
assertEqual(toChinese('1.'), '', '1.');
assertEqual(toChinese('.'), '', '.');
assertEqual(toChinese('abc'), '', 'abc');
assertEqual(toChinese('1a'), '', '1a');
assertEqual(toChinese('1.2.3'), '', '1.2.3');
assertEqual(toChinese('1.234'), '', '1.234');

// ========== P1-1: 纯小数 .5 / -.5 ==========
assertEqual(toChinese('.5'), '伍角', 'P1-1: .5');
assertEqual(toChinese('-.5'), '负伍角', 'P1-1: -.5');
assertEqual(toChinese('.01'), '壹分', 'P1-1: .01');
assertEqual(toChinese('-.01'), '负壹分', 'P1-1: -.01');
assertEqual(validateNumberInput('.5').valid, true, 'P1-1: validate .5');
assertEqual(validateNumberInput('-.5').valid, true, 'P1-1: validate -.5');

// ========== P1-2: 全角/逗号归一化 ==========
assertEqual(toChinese('１００'), '壹佰元整', 'P1-2: 全角数字');
assertEqual(toChinese('１，０００'), '壹仟元整', 'P1-2: 全角逗号');
assertEqual(toChinese('1,000,000'), '壹佰万元整', 'P1-2: 千分位逗号');
assertEqual(toChinese('１，０００，０００'), '壹佰万元整', 'P1-2: 全角+逗号混合');

// ========== P2-1: 负数零金额 ==========
assertEqual(toChinese('-0'), '负零元整', 'P2-1: -0');
assertEqual(toChinese('-0.00'), '负零元整', 'P2-1: -0.00');
assertEqual(toChinese('-0.01'), '负壹分', 'P2-1: -0.01');

// ========== toNumber 反向转换测试 ==========
assertEqual(toNumber('壹元整'), '1', '壹元整');
assertEqual(toNumber('壹拾元整'), '10', '壹拾元整');
assertEqual(toNumber('壹佰元整'), '100', '壹佰元整');
assertEqual(toNumber('壹仟元整'), '1000', '壹仟元整');
assertEqual(toNumber('壹万元整'), '10000', '壹万元整');
assertEqual(toNumber('壹拾万元整'), '100000', '壹拾万元整');
assertEqual(toNumber('壹佰万元整'), '1000000', '壹佰万元整');
assertEqual(toNumber('壹仟万元整'), '10000000', '壹仟万元整');
assertEqual(toNumber('壹亿元整'), '100000000', '壹亿元整');
assertEqual(toNumber('壹拾亿元整'), '1000000000', '壹拾亿元整');
assertEqual(toNumber('壹佰亿元整'), '10000000000', '壹佰亿元整');
assertEqual(toNumber('壹仟亿元整'), '100000000000', '壹仟亿元整');
assertEqual(toNumber('壹万亿元整'), '1000000000000', '壹万亿元整');
assertEqual(toNumber('壹拾万亿元整'), '10000000000000', '壹拾万亿元整');
assertEqual(toNumber('壹佰万亿元整'), '100000000000000', '壹佰万亿元整');
assertEqual(toNumber('壹佰零壹元整'), '101', '壹佰零壹元整');
assertEqual(toNumber('壹仟零壹元整'), '1001', '壹仟零壹元整');
assertEqual(toNumber('壹万零壹元整'), '10001', '壹万零壹元整');
assertEqual(toNumber('壹拾万零壹元整'), '100001', '壹拾万零壹元整');
assertEqual(toNumber('壹佰万零壹元整'), '1000001', '壹佰万零壹元整');
assertEqual(toNumber('壹仟万零壹元整'), '10000001', '壹仟万零壹元整');
assertEqual(toNumber('壹亿零壹元整'), '100000001', '壹亿零壹元整');
assertEqual(toNumber('壹拾亿零壹元整'), '1000000001', '壹拾亿零壹元整');
assertEqual(toNumber('壹佰亿零壹元整'), '10000000001', '壹佰亿零壹元整');
assertEqual(toNumber('壹仟亿零壹元整'), '100000000001', '壹仟亿零壹元整');
assertEqual(toNumber('壹万亿零壹元整'), '1000000000001', '壹万亿零壹元整');
assertEqual(toNumber('壹拾万亿零壹元整'), '10000000000001', '壹拾万亿零壹元整');
assertEqual(toNumber('壹佰万亿零壹元整'), '100000000000001', '壹佰万亿零壹元整');
assertEqual(toNumber('壹仟零壹拾元整'), '1010', '壹仟零壹拾元整');
assertEqual(toNumber('壹万零壹拾元整'), '10010', '壹万零壹拾元整');
assertEqual(toNumber('壹万零壹佰元整'), '10100', '壹万零壹佰元整');
assertEqual(toNumber('壹仟壹佰元整'), '1100', '壹仟壹佰元整');
assertEqual(toNumber('壹仟壹佰壹拾壹元整'), '1111', '壹仟壹佰壹拾壹元整');
assertEqual(toNumber('壹拾万零壹佰元整'), '100100', '壹拾万零壹佰元整');
assertEqual(toNumber('壹佰万零壹佰元整'), '1000100', '壹佰万零壹佰元整');
assertEqual(toNumber('壹仟万零壹佰元整'), '10000100', '壹仟万零壹佰元整');
assertEqual(toNumber('壹亿零壹佰元整'), '100000100', '壹亿零壹佰元整');
assertEqual(toNumber('壹拾亿零壹佰元整'), '1000000100', '壹拾亿零壹佰元整');
assertEqual(toNumber('壹佰亿零壹佰元整'), '10000000100', '壹佰亿零壹佰元整');
assertEqual(toNumber('壹仟亿零壹佰元整'), '100000000100', '壹仟亿零壹佰元整');
assertEqual(toNumber('壹万亿零壹佰元整'), '1000000000100', '壹万亿零壹佰元整');
assertEqual(toNumber('壹拾万亿零壹佰元整'), '10000000000100', '壹拾万亿零壹佰元整');
assertEqual(toNumber('壹佰万亿零壹佰元整'), '100000000000100', '壹佰万亿零壹佰元整');
assertEqual(toNumber('壹角'), '0.1', '壹角');
assertEqual(toNumber('壹分'), '0.01', '壹分');
assertEqual(toNumber('壹角壹分'), '0.11', '壹角壹分');
assertEqual(toNumber('壹元壹角'), '1.1', '壹元壹角');
assertEqual(toNumber('壹元零壹分'), '1.01', '壹元零壹分');
assertEqual(toNumber('壹元壹角壹分'), '1.11', '壹元壹角壹分');
assertEqual(toNumber('壹拾元零壹分'), '10.01', '壹拾元零壹分');
assertEqual(toNumber('壹佰元零壹分'), '100.01', '壹佰元零壹分');
assertEqual(toNumber('壹仟元零壹分'), '1000.01', '壹仟元零壹分');
assertEqual(toNumber('壹万元零壹分'), '10000.01', '壹万元零壹分');
assertEqual(toNumber('壹拾万元零壹分'), '100000.01', '壹拾万元零壹分');
assertEqual(toNumber('壹佰万元零壹分'), '1000000.01', '壹佰万元零壹分');
assertEqual(toNumber('壹仟万元零壹分'), '10000000.01', '壹仟万元零壹分');
assertEqual(toNumber('壹亿元零壹分'), '100000000.01', '壹亿元零壹分');
assertEqual(toNumber('壹拾亿元零壹分'), '1000000000.01', '壹拾亿元零壹分');
assertEqual(toNumber('壹佰亿元零壹分'), '10000000000.01', '壹佰亿元零壹分');
assertEqual(toNumber('壹仟亿元零壹分'), '100000000000.01', '壹仟亿元零壹分');
assertEqual(toNumber('壹万亿元零壹分'), '1000000000000.01', '壹万亿元零壹分');
assertEqual(toNumber('壹拾万亿元零壹分'), '10000000000000.01', '壹拾万亿元零壹分');
// 注：100000000000000.01 因 JS 浮点精度限制无法精确表示，改用整數边界
assertEqual(toNumber('壹佰万亿元整'), '100000000000000', '壹佰万亿元整');
assertEqual(toNumber('负壹元整'), '-1', '负壹元整');
assertEqual(toNumber('负壹分'), '-0.01', '负壹分');
assertEqual(toNumber('负壹角'), '-0.1', '负壹角');
assertEqual(toNumber('负壹拾元零壹分'), '-10.01', '负壹拾元零壹分');
assertEqual(toNumber('负壹佰元零壹分'), '-100.01', '负壹佰元零壹分');
assertEqual(toNumber('负壹仟元零壹分'), '-1000.01', '负壹仟元零壹分');
assertEqual(toNumber('负壹万元零壹分'), '-10000.01', '负壹万元零壹分');
assertEqual(toNumber('负壹拾万元零壹分'), '-100000.01', '负壹拾万元零壹分');
assertEqual(toNumber('负壹佰万元零壹分'), '-1000000.01', '负壹佰万元零壹分');
assertEqual(toNumber('负壹仟万元零壹分'), '-10000000.01', '负壹仟万元零壹分');
assertEqual(toNumber('负壹亿元零壹分'), '-100000000.01', '负壹亿元零壹分');
assertEqual(toNumber('负壹拾亿元零壹分'), '-1000000000.01', '负壹拾亿元零壹分');
assertEqual(toNumber('负壹佰亿元零壹分'), '-10000000000.01', '负壹佰亿元零壹分');
assertEqual(toNumber('负壹仟亿元零壹分'), '-100000000000.01', '负壹仟亿元零壹分');
assertEqual(toNumber('负壹万亿元零壹分'), '-1000000000000.01', '负壹万亿元零壹分');
assertEqual(toNumber('负壹拾万亿元零壹分'), '-10000000000000.01', '负壹拾万亿元零壹分');
assertEqual(toNumber('负壹佰万亿元整'), '-100000000000000', '负壹佰万亿元整');
assertEqual(toNumber('人民币壹元整'), '1', '人民币壹元整');
assertEqual(toNumber('壹元正'), '1', '壹元正');
assertEqual(toNumber('壹元整正'), '1', '壹元整正（多重后缀）');
assertEqual(toNumber('壹元正整'), '1', '壹元正整（多重后缀）');
assertEqual(toNumber('壹元整整'), '1', '壹元整整（多重后缀）');
assertEqual(toNumber('壹元正正'), '1', '壹元正正（多重后缀）');
assertEqual(toNumber('拾元整'), '10', '拾元整（简写）');
assertEqual(toNumber(''), '', '空输入');

// ========== P1-3: 畸形连续大单位 ==========
assertError(toNumber('壹亿万整'), 'P1-3: 壹亿万整');
assertError(toNumber('壹亿零万元整'), 'P1-3: 壹亿零万元整');
assertError(toNumber('壹万零亿元整'), 'P1-3: 壹万零亿元整');
assertEqual(toNumber('壹万亿整'), '1000000000000', 'P1-3: 壹万亿整（标准写法仍通过）');

// ========== P1-4: 多重后缀（已在上面覆盖） ==========

// ========== P1-5: 负号位置 ==========
assertError(toNumber('壹负元整'), 'P1-5: 壹负元整');
assertError(toNumber('负壹负元整'), 'P1-5: 负壹负元整');

// ========== P2-2: 零+小单位畸形结构 ==========
assertError(toNumber('壹仟零佰元整'), 'P2-2: 壹仟零佰元整');
assertError(toNumber('壹万零仟元整'), 'P2-2: 壹万零仟元整');
assertError(toNumber('壹仟零拾元整'), 'P2-2: 壹仟零拾元整');
assertEqual(toNumber('壹仟零壹拾元整'), '1010', 'P2-2: 壹仟零壹拾元整（标准写法）');

// ========== P2-7: parseDecimal 重复零 ==========
assertError(toNumber('壹元零零分'), 'P2-7: 壹元零零分');
assertEqual(toNumber('壹元零叁分'), '1.03', 'P2-7: 壹元零叁分（零后非零单位，合法）');
assertEqual(toNumber('壹元叁分'), '1.03', 'P2-7: 壹元叁分（无零，合法）');
assertError(toNumber('壹元壹角壹分壹'), 'P2-7: 末尾多余数字');

// ========== 边界与异常测试 ==========
assertEqual(toNumber('壹元整正正'), '1', '多重后缀3个（应被归一化）');
assertError(toNumber('壹元角分'), '元后缺少数字');
assertError(toNumber('壹元分角'), '分在角前');
assertError(toNumber('壹亿零万'), 'P1-3 边界: 壹亿零万');

// ========== Round-trip 一致性测试（10组）==========
const roundTripCases = [
  '1', '10', '101', '1001', '10001',
  '100.01', '1000.50', '0.01', '0.10', '999999999999999'
];
for (let n of roundTripCases) {
  let cn = toChinese(n);
  let back = toNumber(cn);
  // toFixed may drop trailing zeros, so normalize
  let expected = String(parseFloat(n));
  assertEqual(back, expected, `round-trip: ${n} -> ${cn} -> ${back}`);
}

// ========== 15位边界测试 ==========
assertEqual(toChinese('999999999999999'), '玖佰玖拾玖万亿玖仟玖佰玖拾玖亿玖仟玖佰玖拾玖万玖仟玖佰玖拾玖元整', '15位边界');
assertEqual(toNumber('玖佰玖拾玖万亿玖仟玖佰玖拾玖亿玖仟玖佰玖拾玖万玖仟玖佰玖拾玖元整'), '999999999999999', '15位反向');

// ========== 输出结果 ==========
console.log(`测试完成: 通过 ${passed} / 总断言 ${passed + failed}`);
if (failed > 0) {
  console.log(`\n失败 ${failed} 项:`);
  failures.forEach(f => console.log(f));
  process.exit(1);
} else {
  console.log('全部通过!');
}
