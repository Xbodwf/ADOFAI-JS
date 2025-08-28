import { AdofaiEvent, LevelOptions, EventCallback, GuidCallback, Tile, ParseProvider } from './interfaces';
import pathData from '../pathdata';
import exportAsADOFAI from '../format'
import BaseParser from '../parser';
import effectProcessor from '../effectProcessor';
import * as presets from '../presets';

export class Level {
    private _events: Map<string, EventCallback[]>;
    private guidCallbacks: Map<string, GuidCallback>;
    private guidCounter: number;
    private _options: string | LevelOptions;
    private _provider?: ParseProvider;
    public angleData!: number[];
    public actions!: AdofaiEvent[];
    public settings!: Record<string, any>;
    public __decorations!: AdofaiEvent[];
    public tiles!: Tile[];
    private _angleDir!: number;
    private _twirlCount!: number;

    constructor(opt: string | LevelOptions, provider?: ParseProvider) {
        this._events = new Map();
        this.guidCallbacks = new Map();
        this.guidCounter = 0;

        this._options = opt;
        this._provider = provider;
    }

    generateGUID(): string {
        return `event_${Date.now()}_${this.guidCounter++}_${Math.floor(Math.random() * 1000)}`;
    }

    load(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            let opt = this._options;
            let options: LevelOptions;

            switch (typeof opt) {
                case 'string':
                    try {
                        options = BaseParser.parseAsObject(opt, this._provider) as LevelOptions;
                    } catch (e) {
                        reject(e);
                        return;
                    }
                    break;
                case 'object':
                    options = Object.assign({}, opt) as LevelOptions;
                    break;
                default:
                    reject("Options must be String or Object");
                    return;
            }
            if (options && typeof options === 'object' && options !== null && typeof options.pathData !== 'undefined') {
                this.angleData = pathData.parseToangleData(options['pathData']!);
            } else {
                if (options && typeof options === 'object' && options !== null && typeof options.angleData !== 'undefined') {
                this.angleData = options['angleData']!;
            } else {
                reject("There is not any angle datas.");
                return;
            }
            }
            if (options && typeof options === 'object' && options !== null && typeof options.actions !== 'undefined') {
                this.actions = options['actions']!;
            } else {
                this.actions = [];
            }
            if (options && typeof options === 'object' && options !== null && typeof options.settings !== 'undefined') {
                this.settings = options['settings']!;
            } else {
                reject("There is no ADOFAI settings.");
                return;
            }
            if (options && typeof options === 'object' && options !== null && typeof options.decorations !== 'undefined') {
                this.__decorations = options['decorations']!;
            } else {
                this.__decorations = [];
            }
            this.tiles = [];
            this._angleDir = -180;
            this._twirlCount = 0;
            this._createArray(this.angleData.length, { angleData: this.angleData, actions: this.actions, decorations: this.__decorations })
                .then(e => {
                    this.tiles = e;
                    this.trigger('load', this);
                    resolve(true);
                }).catch(e => {
                    reject(e);
                });

        });
    }

    on(eventName: string, callback: Function): string {
        if (!this._events.has(eventName)) {
            this._events.set(eventName, []);
        }

        const guid = this.generateGUID();
        const eventCallbacks = this._events.get(eventName)!;

        eventCallbacks.push({ guid, callback });
        this.guidCallbacks.set(guid, { eventName, callback });

        return guid;
    }

    trigger(eventName: string, data: any): void {
        if (!this._events.has(eventName)) return;

        const callbacks = this._events.get(eventName)!;
        callbacks.forEach(({ callback }) => callback(data));
    }

    off(guid: string): void {
        if (!this.guidCallbacks.has(guid)) return;

        const { eventName } = this.guidCallbacks.get(guid)!;
        this.guidCallbacks.delete(guid);

        if (!this._events.has(eventName)) return;

        const callbacks = this._events.get(eventName)!;
        const index = callbacks.findIndex(cb => cb.guid === guid);

        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    }

    private async _createArray(xLength: number, opt: { angleData: number[], actions: AdofaiEvent[], decorations: AdofaiEvent[] }): Promise<Tile[]> {
        let m = Array.from({ length: xLength }, (_, i) => ({
            direction: opt.angleData[i],
            _lastdir: opt.angleData[i - 1] || 0,
            actions: this._filterByFloor(opt.actions, i),
            angle: this._parseAngle(opt.angleData, i, this._twirlCount % 2),
            addDecorations: this._filterByFloorwithDeco(opt.decorations, i),
            twirl: this._twirlCount,
            extraProps: {}
        }));
        return m;
    }

    private _changeAngle(): Tile[] {
        let y = 0;
        let m = this.tiles.map(t => {
            y++;
            t.angle = this._parsechangedAngle(t.direction!, y, t.twirl!, t._lastdir!);
            return t;
        });
        return m;
    }

    private _parsechangedAngle(agd: number, i: number, isTwirl: number, lstagd: number): number {
        let prev = 0;
        if (i === 0) { this._angleDir = 180; }
        if (agd === 999) {
            this._angleDir = lstagd;
            if (isNaN(this._angleDir)) {
                this._angleDir = 0;
            }
            prev = 0;
        } else {
            if (isTwirl === 0) {
                prev = (this._angleDir - agd) % 360;
            } else {
                prev = 360 - (this._angleDir - agd) % 360;
            }
            if (prev === 0) {
                prev = 360;
            }
            this._angleDir = agd + 180;
        }
        return prev;
    }


    private _filterByFloor(arr: AdofaiEvent[], i: number): AdofaiEvent[] {
        let actionT = arr.filter(item => item.floor === i);
        this._twirlCount += actionT.filter(t => t.eventType === 'Twirl').length;
        return actionT.map(({ floor, ...rest }) => rest);
    }

    private _flattenAngleDatas(arr: Tile[]): number[] {
        return arr.map(item => item.direction!);
    }
    private _flattenActionsWithFloor(arr: Tile[]): AdofaiEvent[] {
        return arr.map(item => item.actions).flat();
    }
    private _filterByFloorwithDeco(arr: AdofaiEvent[], i: number): AdofaiEvent[] {
        let actionT = arr.filter(item => item.floor === i);
        return actionT.map(({ floor, ...rest }) => rest);
    }

    private _flattenDecorationsWithFloor(arr: Tile[]): AdofaiEvent[] {
        return arr.map(item => item.addDecorations).flat() as AdofaiEvent[];
    }
    private _parseAngle(agd: number[], i: number, isTwirl: number): number {
        let prev = 0;
        if (i === 0) { this._angleDir = 180; }
        if (agd[i] === 999) {
            this._angleDir = agd[i - 1];
            if (isNaN(this._angleDir)) {
                this._angleDir = 0;
            }
            prev = 0;
        } else {
            if (isTwirl === 0) {
                prev = (this._angleDir - agd[i]) % 360;
            } else {
                prev = 360 - (this._angleDir - agd[i]) % 360;
            }
            if (prev === 0) {
                prev = 360;
            }
            this._angleDir = agd[i] + 180;
        }
        return prev;
    }

    public filterActionsByEventType(en: string): { index: number, action: AdofaiEvent }[] {
        return Object.entries(this.tiles)
            .flatMap(([index, a]) =>
                (a.actions || []).map(b => ({ b, index }))
            )
            .filter(({ b }) => b.eventType === en)
            .map(({ b, index }) => ({
                index: Number(index),
                action: b
            }));
    }

    public getActionsByIndex(en: string, index: number): { count: number, actions: AdofaiEvent[] } {
        const filtered = this.filterActionsByEventType(en);
        const matches = filtered.filter(item => item.index === index);

        return {
            count: matches.length,
            actions: matches.map(item => item.action)
        };
    }
    public calculateTileCoordinates(): void {
        let angles = this.angleData;
        let floats: number[] = [];
        let startPos = [0, 0];

        for (let i = 0; i < this.tiles.length; i++) {
            let value = angles[i];
            if (value === 999) {
                value = angles[i - 1] + 180;
            }
            floats.push(value);
        }

        for (let i = 0; i <= floats.length; i++) {
            let angle1 = Number((i === floats.length) ? floats[i - 1] : floats[i]) || 0;
            let angle2 = Number((i === 0) ? 0 : floats[i - 1]) || 0;
            let currentTile = this.tiles[i];
            if (this.getActionsByIndex('PositionTrack', i).count > 0) {
                let pevent = this.getActionsByIndex('PositionTrack', i).actions[0];
                if (pevent.positionOffset) {
                    if (pevent['editorOnly'] !== true && pevent['editorOnly'] !== 'Enabled') {
                        startPos[0] += pevent['positionOffset'][0];
                        startPos[1] += pevent['positionOffset'][1];
                    }
                }
            }
            startPos[0] += Math.cos(angle1 * Math.PI / 180);
            startPos[1] += Math.sin(angle1 * Math.PI / 180);
            if (typeof currentTile !== 'undefined') {
                currentTile.position = [
                    Number(startPos[0].toFixed(8)),
                    Number(startPos[1].toFixed(8))
                ];
                currentTile.extraProps!.angle1 = angle1;
                currentTile.extraProps!.angle2 = angle2 - 180;
                currentTile.extraProps!.cangle = i === floats.length ? floats[i - 1] + 180 : floats[i];
            }
        }
    }
    public floorOperation(info: { type: 'append' | 'insert' | 'delete', direction: number, id?: number } = { type: 'append', direction: 0 }): void {
        switch (info.type) {
            case 'append':
                this.appendFloor(info);
                break;
            case 'insert':
                if (typeof info.id === 'number') {
                    this.tiles.splice(info.id, 0, {
                        direction: info.direction || 0,
                        angle: 0,
                        actions: [],
                        addDecorations: [],
                        _lastdir: this.tiles[info.id - 1].direction,
                        twirl: this.tiles[info.id - 1].twirl
                    });
                }
                break;
            case 'delete':
                if (typeof info.id === 'number') {
                    this.tiles.splice(info.id, 1);
                }
                break;
        }
        this._changeAngle();
    }

    public appendFloor(args: { direction: number }): void {
        this.tiles.push({
            direction: args.direction,
            angle: 0,
            actions: [],
            addDecorations: [],
            _lastdir: this.tiles[this.tiles.length - 1].direction,
            twirl: this.tiles[this.tiles.length - 1].twirl,
            extraProps: {}
        });
        this._changeAngle();
    }

    public clearDeco(): boolean {
        this.tiles = effectProcessor.clearDecorations(this.tiles) as Tile[];
        return true;
    }

    public clearEffect(presetName: string): void {
        this.clearEvent(presets[presetName as keyof typeof presets]);
    }

    public clearEvent(preset: { type: string, events: string[] }): void {
        switch (preset.type) {
            case 'include':
                this.tiles = effectProcessor.keepEvents(preset.events, this.tiles) as Tile[];
                break;
            case 'exclude':
                this.tiles = effectProcessor.clearEvents(preset.events, this.tiles) as Tile[];
                break;
        }
    }
    public export(type: 'string' | 'object', indent?: number, useAdofaiStyle: boolean = true): string | Record<string, any> {
        const ADOFAI = {
            angleData: this._flattenAngleDatas(this.tiles),
            settings: this.settings,
            actions: this._flattenActionsWithFloor(this.tiles),
            decorations: this._flattenDecorationsWithFloor(this.tiles)
        };
        return type === 'object' ? ADOFAI : exportAsADOFAI(ADOFAI, indent, useAdofaiStyle);
    }
}