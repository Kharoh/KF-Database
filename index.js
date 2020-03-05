// modules imports
const Database = require('better-sqlite3')
// Lodash
const {
    get: _get,
    set: _set,
    has: _has,
    delete: _delete,
    isNil,
    isFunction,
    isArray,
    isObject,
    toPath,
    merge,
    clone,
    cloneDeep,
} = require('lodash')

// Native imports
const fs = require('fs')
const { resolve, sep } = require('path')

class Base extends Map {
    constructor(options) {
        super()
        if (!options) options = {}

        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data')
        }

        const dataDir = resolve(process.cwd(), options.dataDir || 'data')
        const database = new Database(`${dataDir}${sep}base.sqlite`)

        this.init(database)
    }

    init(database) {
        this.db = database
        console.log(this.db)
    }

}

const data = new Base()
