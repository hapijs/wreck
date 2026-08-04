import * as Stream from 'node:stream';

import { Payload } from './payload.js';

export class Tap extends Stream.Transform {
    constructor() {
        super();
        this.buffers = [];
    }

    _transform(chunk, encoding, next) {
        this.buffers.push(chunk);
        next(null, chunk);
    }

    collect() {
        return new Payload(this.buffers);
    }
}
