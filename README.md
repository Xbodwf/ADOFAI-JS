# ADOFAI

A Javascript library for ADOFAI levels.

## Usage
Preview / Edit the `.adofai` file.

Re_ADOJAS(A Level Player of ADOFAI) uses `adofai` to parse ADOFAI Level file.

## Installation

```bash
npm install adofai
# or
yarn add adofai
# or
pnpm install adofai
```

if you want to display highlight of adofai file, you can use `Rhythm Game Syntax Highlighter` vscode extension.

## Got Started

### Import

For Commonjs:
```ts
const adofai = require('adofai');
```

For ES6 Modules:
```ts
import * as adofai from 'adofai';
```

### Create a Level

```ts
const file = new adofai.Level(adofaiFileContent);

//or

const parser = new adofai.Parsers.StringParser();
const file = new adofai.Level(adofaiFileContent,parser);

//The advantage of the latter over the former is that it pre-initializes the Parser, avoiding multiple instantiations.
```

Format:
```ts
class Level {
    constructor(opt: string | LevelOptions, provider?: ParseProvider)
 }

```
Available ParseProviders: 
`StringParser` `ArrayBufferParser` `BufferParser`


Usually,only `StringParser` is needed.
but you can use `BufferParser` to parse ADOFAI files in Node environment.

On browser, you can also use `ArrayBuffer` to parse ADOFAI files.
(`BufferParser` is not available in browser,but you can use browserify `Buffer` to polyfill)

### Load Level
```ts
file.on('load'() => {
    //logic...
})
file.load()
```

or you can use `then()`
```ts
file.load().then(() => {

})
```

### Export Level
```ts
type FileType = 'string'|'object'

file.export(type: FileType = 'string',indent?:number,useAdofaiStyle:boolean = true)
```

method `export()` returns a Object or String.

Object: return ADOFAI Object.
String: return ADOFAI String.

```ts
import fs from 'fs'
type FileType = 'string'|'object'

const content = file.export('string',null,true);
fs.writeFileSync('output.adofai',content)
```


## Data Operation

See interfaces to see all data.

```ts
//Get AngleDatas:
const angleDatas = file.angleData;



```