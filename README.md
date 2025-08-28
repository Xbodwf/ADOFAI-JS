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
export interface AdofaiEvent {
    eventType: string;
    [key: string]: any;
}

export interface LevelOptions {
    pathData?: string;
    angleData?: number[];
    actions: AdofaiEvent[];
    settings: Record<string, any>;
    decorations: AdofaiEvent[];
    [key: string]: any;
}

export interface EventCallback {
    guid: string;
    callback: Function;
}

export interface GuidCallback {
    eventName: string;
    callback: Function;
}

export interface Tile {
    direction?: number;
    angle?: number;
    actions: AdofaiEvent[];
    addDecorations?: AdofaiEvent[];
    _lastdir?: number;
    twirl?: number;
    position?: number[];
    extraProps?: Record<string, any>;
}

export interface ParseProvider {
    parse(t: string): LevelOptions;
}
```

For Level:

```ts
import { AdofaiEvent, LevelOptions, Tile, ParseProvider } from './interfaces';
export declare class Level {
    private _events;
    private guidCallbacks;
    private guidCounter;
    private _options;
    private _provider?;
    angleData: number[];
    actions: AdofaiEvent[];
    settings: Record<string, any>;
    __decorations: AdofaiEvent[];
    tiles: Tile[];
    private _angleDir;
    private _twirlCount;
    constructor(opt: string | LevelOptions, provider?: ParseProvider);
    generateGUID(): string;
    load(): Promise<boolean>;
    on(eventName: string, callback: Function): string;
    trigger(eventName: string, data: any): void;
    off(guid: string): void;
    private _createArray;
    private _changeAngle;
    private _parsechangedAngle;
    private _filterByFloor;
    private _flattenAngleDatas;
    private _flattenActionsWithFloor;
    private _filterByFloorwithDeco;
    private _flattenDecorationsWithFloor;
    private _parseAngle;
    filterActionsByEventType(en: string): {
        index: number;
        action: AdofaiEvent;
    }[];
    getActionsByIndex(en: string, index: number): {
        count: number;
        actions: AdofaiEvent[];
    };
    calculateTileCoordinates(): void;
    floorOperation(info?: {
        type: 'append' | 'insert' | 'delete';
        direction: number;
        id?: number;
    }): void;
    appendFloor(args: {
        direction: number;
    }): void;
    clearDeco(): boolean;
    clearEffect(presetName: string): void;
    clearEvent(preset: {
        type: string;
        events: string[];
    }): void;
    export(type: 'string' | 'object', indent?: number, useAdofaiStyle?: boolean): string | Record<string, any>;
}

```