import { AdofaiEvent, LevelOptions, EventCallback, GuidCallback, Tile, ParseProvider, ParseProgressEvent } from './interfaces';
import pathData from '../pathdata';
import exportAsADOFAI from './format'
import BaseParser from '../parser';
import effectProcessor from '../filter/effectProcessor';
import { EffectCleanerType } from '../filter/effectProcessor';
import { v4 as uuid } from 'uuid';
import * as presets from '../filter/presets';

export class Level {
    private _events: Map<string, EventCallback[]>;
    private guidCallbacks: Map<string, GuidCallback>;
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

        this._options = opt;
        this._provider = provider;
    }

    generateGUID(): string {
        return `event_${uuid()}`;
    }

    /**
     * 触发进度事件
     */
    private _emitProgress(
        stage: ParseProgressEvent['stage'],
        current: number,
        total: number,
        data?: ParseProgressEvent['data']
    ): void {
        const progressEvent: ParseProgressEvent = {
            stage,
            current,
            total,
            percent: total > 0 ? Math.round((current / total) * 100) : 0,
            data
        };
        this.trigger('parse:progress', progressEvent);
        this.trigger(`parse:${stage}`, progressEvent);
    }

    load(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            let opt = this._options;
            let options: LevelOptions;

            // 阶段1: 解析输入
            this._emitProgress('start', 0, 0);

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

            // 阶段2: 处理 pathData 或 angleData
            const hasPathData = options && typeof options === 'object' && options !== null && typeof options.pathData !== 'undefined';
            const hasAngleData = options && typeof options === 'object' && options !== null && typeof options.angleData !== 'undefined';

            if (hasPathData) {
                const pathDataStr = options['pathData']!;
                // 开始转换 pathData
                this._emitProgress('pathData', 0, pathDataStr.length, { source: pathDataStr });
                this.angleData = pathData.parseToangleData(pathDataStr);
                // 转换完成，返回结果
                this._emitProgress('pathData', pathDataStr.length, pathDataStr.length, {
                    source: pathDataStr,
                    processed: this.angleData
                });
            } else if (hasAngleData) {
                this.angleData = options['angleData']!;
                this._emitProgress('angleData', this.angleData.length, this.angleData.length, {
                    processed: this.angleData
                });
            } else {
                reject("There is not any angle datas.");
                return;
            }

            // 阶段3: 提取其他数据
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

            // 阶段4: 创建 Tile 数组（带进度回调）
            this._createArray(this.angleData.length, { angleData: this.angleData, actions: this.actions, decorations: this.__decorations })
                .then(e => {
                    this.tiles = e;
                    this._emitProgress('complete', this.angleData.length, this.angleData.length);
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
        const tiles: Tile[] = [];
        const batchSize = Math.max(1, Math.floor(xLength / 100)); // 每批处理的数量，至少1个

        for (let i = 0; i < xLength; i++) {
            // 计算相对角度（会更新 _twirlCount）
            const angle = this._parseAngle(opt.angleData, i, this._twirlCount % 2);

            const tile: Tile = {
                direction: opt.angleData[i],
                _lastdir: opt.angleData[i - 1] || 0,
                actions: this._filterByFloor(opt.actions, i),
                angle: angle,
                addDecorations: this._filterByFloorwithDeco(opt.decorations, i),
                twirl: this._twirlCount,
                extraProps: {}
            };

            tiles.push(tile);

            // 每处理一批或最后一个时触发进度事件
            if (i % batchSize === 0 || i === xLength - 1) {
                this._emitProgress('relativeAngle', i + 1, xLength, {
                    tileIndex: i,
                    tile: tile,
                    angle: opt.angleData[i],
                    relativeAngle: angle
                });
                // 让出事件循环，避免阻塞
                if (i % (batchSize * 10) === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }
            }
        }
        return tiles;
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

    private _normalizeAngle(v: number): number {
        return ((v % 360) + 360) % 360;
    }

    private _parsechangedAngle(agd: number, i: number, isTwirl: number, lstagd: number): number {
        let prev = 0;
        if (i === 0) { this._angleDir = 180; }
        if (agd === 999) {
            this._angleDir = this._normalizeAngle(lstagd);
            if (isNaN(this._angleDir)) {
                this._angleDir = 0;
            }
            prev = 0;
        } else {
            const delta = this._normalizeAngle(this._angleDir - agd);
            if (isTwirl === 0) {
                prev = delta;
            } else {
                prev = this._normalizeAngle(360 - delta);
            }
            if (prev === 0) {
                prev = 360;
            }
            this._angleDir = this._normalizeAngle(agd + 180);
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
        return arr.flatMap((tile, index) =>
            (tile?.actions || []).map(({ floor, ...rest }) => ({ floor: index, ...rest } as AdofaiEvent))
        );
    }
    private _filterByFloorwithDeco(arr: AdofaiEvent[], i: number): AdofaiEvent[] {
        let actionT = arr.filter(item => item.floor === i);
        return actionT.map(({ floor, ...rest }) => rest);
    }

    private _flattenDecorationsWithFloor(arr: Tile[]): AdofaiEvent[] {
        return arr.flatMap((tile, index) =>
            (tile?.addDecorations || []).map(({ floor, ...rest }) => ({ floor: index, ...rest } as AdofaiEvent))
        );
    }
    private _parseAngle(agd: number[], i: number, isTwirl: number): number {
        let prev = 0;
        if (i === 0) { this._angleDir = 180; }
        if (agd[i] === 999) {
            this._angleDir = this._normalizeAngle(agd[i - 1]);
            if (isNaN(this._angleDir)) {
                this._angleDir = 0;
            }
            prev = 0;
        } else {
            const delta = this._normalizeAngle(this._angleDir - agd[i]);
            if (isTwirl === 0) {
                prev = delta;
            } else {
                prev = this._normalizeAngle(360 - delta);
            }
            if (prev === 0) {
                prev = 360;
            }
            this._angleDir = this._normalizeAngle(agd[i] + 180);
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
        console.warn("calculateTileCoordinates is deprecated. Use calculateTilePosition instead.");
    }

    /**
     * 计算所有 Tile 的坐标位置
     * 触发 parse:tilePosition 和 parse:progress 事件报告进度
     * 
     * 性能优化：预先构建 PositionTrack 索引，避免循环内重复遍历
     */
    public calculateTilePosition(): number[][] {
        const angles = this.angleData;
        const totalTiles = this.tiles.length;
        const positions: number[][] = [];
        const startPos = [0, 0];

        // 性能优化：预先构建 PositionTrack 索引 Map，O(n) 预处理
        const positionTrackMap = new Map<number, AdofaiEvent>();
        for (const action of this.actions) {
            if (action.eventType === 'PositionTrack' && action.positionOffset) {
                if (action.editorOnly !== true && action.editorOnly !== 'Enabled') {
                    positionTrackMap.set(action.floor, action);
                }
            }
        }

        // 触发开始事件
        this._emitProgress('tilePosition', 0, totalTiles);

        // 预处理 floats 数组
        const floats = new Array<number>(totalTiles);
        for (let i = 0; i < totalTiles; i++) {
            floats[i] = angles[i] === 999 ? angles[i - 1] + 180 : angles[i];
        }

        // 进度事件触发频率：每 1% 或最少每 100 个 tile 触发一次
        const progressInterval = Math.max(100, Math.floor(totalTiles / 100));

        for (let i = 0; i <= totalTiles; i++) {
            const isLastTile = i === totalTiles;
            const angle1 = isLastTile ? (floats[i - 1] || 0) : floats[i];
            const angle2 = i === 0 ? 0 : (floats[i - 1] || 0);
            const currentTile = this.tiles[i];

            // 使用索引 Map 直接查询，O(1) 复杂度
            const posTrack = positionTrackMap.get(i);
            if (posTrack?.positionOffset) {
                startPos[0] += posTrack.positionOffset[0] as number;
                startPos[1] += posTrack.positionOffset[1] as number;
            }

            const tempPos = [startPos[0], startPos[1]];
            positions.push(tempPos);

            if (currentTile) {
                currentTile.position = tempPos;
                currentTile.extraProps!.angle1 = angle1;
                currentTile.extraProps!.angle2 = angle2 - 180;
                currentTile.extraProps!.cangle = isLastTile ? floats[i - 1] + 180 : floats[i];
            }

            // 更新位置
            const rad = angle1 * Math.PI / 180;
            startPos[0] += Math.cos(rad);
            startPos[1] += Math.sin(rad);

            // 触发进度事件（降低频率）
            if (i % progressInterval === 0 || isLastTile) {
                this._emitProgress('tilePosition', i, totalTiles, {
                    tileIndex: i,
                    tile: currentTile,
                    position: tempPos,
                    angle: angle1
                });
            }
        }

        // 触发完成事件
        this._emitProgress('tilePosition', totalTiles, totalTiles, {
            processed: positions.flat()
        });

        return positions;
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

    public clearEvent(preset: { type: EffectCleanerType | string, events: string[] }): void {
        if (preset.type == EffectCleanerType.include) {
            this.tiles = effectProcessor.keepEvents(preset.events, this.tiles) as Tile[];
        } else if (preset.type == EffectCleanerType.exclude) {
            this.tiles = effectProcessor.clearEvents(preset.events, this.tiles) as Tile[];
        }
    }
    public export(type: 'string' | 'object', indent: number, useAdofaiStyle: boolean = true, indentChar: string, indentStep: number): string | Record<string, any> {
        const ADOFAI = {
            angleData: this._flattenAngleDatas(this.tiles),
            settings: this.settings,
            actions: this._flattenActionsWithFloor(this.tiles),
            decorations: this._flattenDecorationsWithFloor(this.tiles)
        };
        return type === 'object' ? ADOFAI : exportAsADOFAI(ADOFAI, indent, useAdofaiStyle, indentChar, indentStep);
    }
}