const BOM = Buffer.of(0xef, 0xbb, 0xbf)
const COMMA = Buffer.from(",")

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

export function normalizeJsonString(text: string): string {
  return normalizeJsonBuffer(Buffer.from(text, "utf-8")).toString("utf-8")
}

export function decodeStringFromUTF8BOM(buffer: Buffer): string {
  return stripBOM(buffer).toString("utf-8")
}

export function encodeStringAsUTF8BOM(text: string): Buffer {
  return Buffer.concat([BOM, stripBOM(Buffer.from(text, "utf-8"))])
}

export function decodeJsonFromString(text: string): any {
  return JSON.parse(normalizeJsonString(text))
}

export function decodeJsonFromBuffer(buffer: Buffer): any {
  return JSON.parse(
    decodeStringFromUTF8BOM(normalizeJsonBuffer(stripBOM(buffer))),
  )
}

export function encodeJsonAsString(obj: any): string {
  return JSON.stringify(obj)
}

export function encodeJsonAsBufferUTF8BOM(obj: any): Buffer {
  return encodeStringAsUTF8BOM(encodeJsonAsString(obj))
}

export function parse(text: string): any {
  return decodeJsonFromString(text)
}

export function stringify(obj: any): string {
  return encodeJsonAsString(obj)
}

export default {parse,stringify}