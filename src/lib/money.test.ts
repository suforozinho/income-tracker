import { describe, expect, it } from "vitest";
import {
  add,
  convert,
  divideRounded,
  formatMoney,
  formatQuantity,
  formatRate,
  multiplyByQuantity,
  parseDecimal,
  parseMoney,
  percentOf,
  sum,
  toMoneyInput,
} from "./money";

describe("divideRounded", () => {
  it("rounds half away from zero", () => {
    expect(divideRounded(BigInt(5), BigInt(10))).toBe(1);
    expect(divideRounded(BigInt(4), BigInt(10))).toBe(0);
    expect(divideRounded(BigInt(-5), BigInt(10))).toBe(-1);
    expect(divideRounded(BigInt(-4), BigInt(10))).toBe(0);
    expect(divideRounded(BigInt(15), BigInt(10))).toBe(2);
    expect(divideRounded(BigInt(25), BigInt(10))).toBe(3);
  });

  it("refuses to divide by zero", () => {
    expect(() => divideRounded(BigInt(1), BigInt(0))).toThrow(RangeError);
  });
});

describe("adding money", () => {
  it("avoids the floating-point trap", () => {
    // 0.1 + 0.2 !== 0.3 in floats; 10 + 20 === 30 in cents.
    expect(add(10, 20)).toBe(30);
    expect(sum([1999, 1, 0])).toBe(2000);
  });

  it("rejects fractional cents", () => {
    expect(() => add(10.5, 1)).toThrow(RangeError);
  });

  it("handles large amounts exactly", () => {
    const tenMillion = 1_000_000_000;
    expect(sum(Array.from({ length: 1000 }, () => tenMillion))).toBe(1_000_000_000_000);
  });
});

describe("multiplyByQuantity", () => {
  it("multiplies by whole quantities", () => {
    expect(multiplyByQuantity(12_500, 300)).toBe(37_500);
  });

  it("multiplies by fractional quantities and rounds once", () => {
    // $33.33/h x 1.5h = $49.995 -> $50.00
    expect(multiplyByQuantity(3333, 150)).toBe(5000);
    // $0.01 x 0.5 = $0.005 -> $0.01
    expect(multiplyByQuantity(1, 50)).toBe(1);
    // $0.01 x 0.49 -> $0.00
    expect(multiplyByQuantity(1, 49)).toBe(0);
  });

  it("is exact where floats are not", () => {
    // 1.005 * 100 in floats is 100.49999999999999
    expect(multiplyByQuantity(1005, 100)).toBe(1005);
    expect(multiplyByQuantity(100, 1005)).toBe(1005);
  });

  it("handles large amounts without losing precision", () => {
    expect(multiplyByQuantity(1_000_000_000, 99_999)).toBe(999_990_000_000);
  });
});

describe("convert", () => {
  it("converts USD cents to BRL centavos with a PTAX rate", () => {
    // $1,000.00 at 5.7324 = R$5,732.40
    expect(convert(100_000, 5_732_400)).toBe(573_240);
  });

  it("rounds the converted amount once, half away from zero", () => {
    // $0.01 at 5.5 = R$0.055 -> R$0.06
    expect(convert(1, 5_500_000)).toBe(6);
  });

  it("does not overflow on big invoices with precise rates", () => {
    // $10,000,000.00 at 6.123456
    expect(convert(1_000_000_000, 6_123_456)).toBe(6_123_456_000);
  });
});

describe("percentOf", () => {
  it("works in basis points", () => {
    expect(percentOf(1_000_000, 600)).toBe(60_000);
    expect(percentOf(333, 1550)).toBe(52); // 51.615 -> 52
  });
});

describe("formatMoney", () => {
  it("formats each currency in English", () => {
    expect(formatMoney(123_456, "USD")).toBe("$1,234.56");
    expect(formatMoney(123_456, "EUR")).toBe("€1,234.56");
    expect(formatMoney(123_456, "BRL")).toBe("R$1,234.56");
    expect(formatMoney(-5, "USD")).toBe("-$0.05");
  });
});

describe("parsing typed amounts", () => {
  it("parses common inputs without floats", () => {
    expect(parseMoney("1,234.56")).toBe(123_456);
    expect(parseMoney("1234.5")).toBe(123_450);
    expect(parseMoney("  12 ")).toBe(1200);
    expect(parseMoney("0.07")).toBe(7);
    expect(parseMoney("$99.99")).toBe(9999);
    expect(parseMoney("R$ 10")).toBe(1000);
    expect(parseMoney("-3.10")).toBe(-310);
  });

  it("rejects things that are not money", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1.234")).toBeNull();
    expect(parseMoney("1.2.3")).toBeNull();
    expect(parseMoney("1e5")).toBeNull();
  });

  it("parses rates with up to six decimals", () => {
    expect(parseDecimal("5.7324", 6)).toBe(5_732_400);
    expect(parseDecimal("6.123456", 6)).toBe(6_123_456);
  });

  it("round-trips through the input format", () => {
    for (const cents of [0, 1, 10, 99, 100, 123_456, 1_000_000_000]) {
      expect(parseMoney(toMoneyInput(cents))).toBe(cents);
    }
  });
});

describe("display helpers", () => {
  it("formats quantities and rates", () => {
    expect(formatQuantity(150)).toBe("1.5");
    expect(formatQuantity(200)).toBe("2");
    expect(formatQuantity(5)).toBe("0.05");
    expect(formatRate(5_732_400)).toBe("5.7324");
    expect(formatRate(6_123_456)).toBe("6.123456");
  });
});
