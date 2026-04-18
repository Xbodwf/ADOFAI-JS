import Parser from "./Parser";

/**
 * 字节流原生 JSON 解析器
 * 直接在 Uint8Array 上运行状态机，支持非标换行，且无需预转字符串。
 */
export class BufferParser extends Parser<Uint8Array | Buffer | string, any> {
  parse(input: Uint8Array | Buffer | string): any {
    let u8: Uint8Array;
    
    if (typeof input === "string") {
      // 如果输入是字符串，转为字节流处理以保持逻辑统一
      u8 = new TextEncoder().encode(input);
    } else {
      u8 = stripBOM(input);
    }

    const engine = new BufferParserEngine(u8);
    return engine.parseValue();
  }

  stringify(obj: any): string {
    return JSON.stringify(obj);
  }
}

class BufferParserEngine {
  private pos = 0;
  private length: number;
  private decoder = new TextDecoder("utf-8");

  constructor(private data: Uint8Array) {
    this.length = data.length;
  }

  parseValue(): any {
    this.eatWhitespace();
    const byte = this.peek();
    if (byte === -1) return null;

    switch (byte) {
      case 123: return this.parseObject(); // {
      case 91:  return this.parseArray();  // [
      case 34:  return this.parseString(); // "
      case 116: return this.parseKeyword(true);  // t(rue)
      case 102: return this.parseKeyword(false); // f(alse)
      case 110: return this.parseKeyword(null);  // n(ull)
      case 45:  // -
      case 48: case 49: case 50: case 51: case 52:
      case 53: case 54: case 55: case 56: case 57:
        return this.parseNumber();
      default:
        this.pos++;
        return null;
    }
  }

  private parseObject(): Record<string, any> {
    const obj: Record<string, any> = {};
    this.pos++; // skip {
    
    while (true) {
      this.eatWhitespace();
      if (this.peek() === 125) { // }
        this.pos++;
        break;
      }

      const key = this.parseString();
      this.eatWhitespace();
      if (this.peek() !== 58) break; // :
      this.pos++; 

      obj[key] = this.parseValue();

      this.eatWhitespace();
      if (this.peek() === 44) { // ,
        this.pos++;
      }
    }
    return obj;
  }

  private parseArray(): any[] {
    const arr: any[] = [];
    this.pos++; // skip [
    
    while (true) {
      this.eatWhitespace();
      if (this.peek() === 93) { // ]
        this.pos++;
        break;
      }

      arr.push(this.parseValue());

      this.eatWhitespace();
      if (this.peek() === 44) { // ,
        this.pos++;
      }
    }
    return arr;
  }

  /**
   * 核心修改：支持字符串内原始换行 (10, 13)
   */
  private parseString(): string {
    this.pos++; // skip "
    const start = this.pos;
    let hasEscapes = false;

    while (this.pos < this.length) {
      const b = this.data[this.pos];
      if (b === 34) break; // "
      if (b === 92) { // \
        hasEscapes = true;
        this.pos += 2; // 简单跳过转义序列
      } else {
        this.pos++;
      }
    }

    const end = this.pos;
    this.pos++; // skip closing "

    const raw = this.data.subarray(start, end);
    if (!hasEscapes) {
      return this.decoder.decode(raw);
    } else {
      // 处理转义字符逻辑
      return this.processEscapes(raw);
    }
  }

  private processEscapes(raw: Uint8Array): string {
    // 降级处理带有转义的字符串：转成文本后用类似 StringParser 的逻辑处理
    const str = this.decoder.decode(raw);
    let result = "";
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "\\" && i + 1 < str.length) {
        const next = str[++i];
        switch (next) {
          case '"': case '\\': case '/': result += next; break;
          case 'b': result += '\b'; break;
          case 'f': result += '\f'; break;
          case 'n': result += '\n'; break;
          case 'r': result += '\r'; break;
          case 't': result += '\t'; break;
          case 'u': 
            result += String.fromCharCode(parseInt(str.substr(i + 1, 4), 16));
            i += 4;
            break;
        }
      } else {
        result += str[i];
      }
    }
    return result;
  }

  private parseNumber(): number {
    const start = this.pos;
    while (this.pos < this.length) {
      const b = this.data[this.pos];
      // 0-9 . e E + -
      if ((b >= 48 && b <= 57) || b === 46 || b === 101 || b === 69 || b === 43 || b === 45) {
        this.pos++;
      } else {
        break;
      }
    }
    const s = this.decoder.decode(this.data.subarray(start, this.pos));
    return parseFloat(s);
  }

  private parseKeyword(value: any): any {
    // 简单地跳过 true, false, null 的长度
    const b = this.data[this.pos];
    if (b === 116) this.pos += 4; // true
    else if (b === 102) this.pos += 5; // false
    else if (b === 110) this.pos += 4; // null
    return value;
  }

  private eatWhitespace(): void {
    while (this.pos < this.length) {
      const b = this.data[this.pos];
      if (b === 32 || b === 10 || b === 13 || b === 9) {
        this.pos++;
      } else {
        break;
      }
    }
  }

  private peek(): number {
    return this.pos < this.length ? this.data[this.pos] : -1;
  }
}

export function stripBOM(buffer: Uint8Array | Buffer): Uint8Array {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3);
  }
  return buffer;
}

export default BufferParser;
