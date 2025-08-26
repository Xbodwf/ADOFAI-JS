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