import Parser from "./Parser";
import StringParser from "./StringParser";

const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
const COMMA = new Uint8Array([44]); // ASCII for ','

export class ArrayBufferParser extends Parser<ArrayBuffer | string, any> {
  parse(input: ArrayBuffer | string): any {
    if (typeof input === "string") {
      return StringParser.prototype.parse.call(StringParser.prototype, input);
    } else {
      return StringParser.prototype.parse.call(StringParser.prototype, decodeStringFromUTF8BOM(normalizeJsonArrayBuffer(stripBOM(input))));
    }
  }
  stringify(obj: any): string {
    return JSON.stringify(obj);
  }
}

export function stripBOM(buffer: ArrayBuffer): ArrayBuffer {
  const view = new Uint8Array(buffer);
  if (view.length >= 3 && view[0] === BOM[0] && view[1] === BOM[1] && view[2] === BOM[2]) {
    return buffer.slice(3);
  }
  return buffer;
}

export function normalizeJsonArrayBuffer(buffer: ArrayBuffer): ArrayBuffer {
  const view = new Uint8Array(buffer);
  let builder: Uint8Array[] = [];
  let last: "other" | "string" | "escape" | "comma" = "other";
  let from = 0;

  for (let i = 0; i < view.length; i++) {
    const charCode = view[i];
    if (last == "escape") {
      last = "string";
    } else {
      switch (charCode) {
        case 34: // "
          switch (last) {
            case "string":
              last = "other";
              break;
            case "comma":
              builder.push(COMMA);
            default:
              last = "string";
              break;
          }
          break;
        case 92: // \
          if (last === "string") last = "escape";
          break;
        case 44: // ,
          builder.push(view.subarray(from, i));
          from = i + 1;
          if (last === "other") last = "comma";
          break;
        case 93: // ]
        case 125: // }
          if (last === "comma") last = "other";
          break;
        case 9: // \t
        case 10: // \n
        case 11: // \v
        case 12: // \f
        case 13: // \r
        case 32: // space
          break;
        default:
          if (last === "comma") {
            builder.push(COMMA);
            last = "other";
          }
          break;
      }
    }
  }
  builder.push(view.subarray(from));

  let totalLength = 0;
  for (const arr of builder) {
    totalLength += arr.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of builder) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result.buffer;
}

export function decodeStringFromUTF8BOM(buffer: ArrayBuffer): string {
  const strippedBuffer = stripBOM(buffer);
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(strippedBuffer);
}

export default ArrayBufferParser;