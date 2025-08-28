import Parser from "./Parser";
import StringParser from "./StringParser";

let BOM: Buffer;
let COMMA: Buffer;

try {
  BOM = Buffer.of(0xef, 0xbb, 0xbf);
  COMMA = Buffer.from(",");
} catch (e) {
  console.warn('Buffer is not available in current environment, try to use ArrayBufferParser');
  BOM = { equals: () => false, subarray: () => null } as any;
  COMMA = { equals: () => false, subarray: () => null } as any;
}

export class BufferParser extends Parser<Buffer | string, any> {
  parse(input: Buffer | string): any {
    if (typeof input === "string") {
      return StringParser.prototype.parse.call(StringParser.prototype, input);
    } else {
      return StringParser.prototype.parse.call(StringParser.prototype, decodeStringFromUTF8BOM(normalizeJsonBuffer(stripBOM(input))));
    }
  }
  stringify(obj: any): string {
    return JSON.stringify(obj);
  }
}

export function stripBOM(buffer: Buffer): Buffer {
  if (buffer.length >= 3 && BOM.equals(buffer.subarray(0, 3))) {
    return buffer.subarray(3)
  }
  return buffer
}

export function normalizeJsonBuffer(text: Buffer): Buffer {
  let builder: Buffer[] = []
  let last: "other" | "string" | "escape" | "comma" = "other"
  let from = 0
  text.forEach((charCode, i) => {
    if (last == "escape") {
      last = "string"
    } else {
      switch (charCode) {
        case 34:
          switch (last) {
            case "string":
              last = "other"
              break
            case "comma":
              builder.push(COMMA)
            default:
              last = "string"
              break
          }
          break
        case 92:
          if (last === "string") last = "escape"
          break
        case 44:
          builder.push(text.subarray(from, i))
          from = i + 1
          if (last === "other") last = "comma"
          break
        case 93:
        case 125:
          if (last === "comma") last = "other"
          break
        case 9:
        case 10:
        case 11:
        case 12:
        case 13:
        case 32:
          break
        default:
          if (last === "comma") {
            builder.push(COMMA)
            last = "other"
          }
          break
      }
    }
  })
  builder.push(text.subarray(from))
  return Buffer.concat(builder)
}

export function decodeStringFromUTF8BOM(buffer: Buffer): string {
  return stripBOM(buffer).toString("utf-8")
}

export default BufferParser;