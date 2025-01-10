import { KawaiAction } from './types';

type KawaiId = string;

export class KawaiCategoryBase {
    id: string;

    constructor(id: string) {
        this.id = id;
    }
}

export class KawaiMenuBase {
    id: string;
    category: string;

    constructor(id: string, category: string) {
        this.id = id;
        this.category = category;
    }
}
