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

export interface ParseProgressEvent {
    stage: 'start' | 'pathData' | 'angleData' | 'relativeAngle' | 'tilePosition' | 'complete';
    current: number;
    total: number;
    percent: number;
    /** 当前阶段产生的数据 */
    data?: {
        /** pathData 阶段: 原始 pathData 字符串; angleData 阶段: 解析后的角度数组 */
        source?: string | number[];
        /** 已处理的部分数据 */
        processed?: number[];
        /** 当前处理的 tile 数据 */
        tile?: Tile;
        /** 当前处理的 tile 索引 */
        tileIndex?: number;
        /** angleData: 当前角度值 */
        angle?: number;
        /** relativeAngle: 计算出的相对角度 */
        relativeAngle?: number;
        /** tilePosition: 当前坐标 */
        position?: number[];
    };
}