// Native imports
const fs = require('fs')
const { resolve, sep } = require('path')

// Modules imports
const Database = require('better-sqlite3')
const {
    get: _get,
    set: _set,
    isNil,
    isArray,
    toPath,
} = require('lodash')

// Use Symbols to create private methods
const _init = Symbol('init')

class Base extends Map {
    constructor(options) {
        super()

        if (!options) throw new Error('Expected one option argument in the constructor call')
        if (!options.name) throw new Error('You should give a name to your Database')
        this.name = options.name

        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data')
        }

        const dataDir = resolve(process.cwd(), options.dataDir || 'data')
        const database = new Database(`${dataDir}${sep}base.sqlite`)

        this[_init](database)
    }

    [_init](database) {
        this.db = database

        const table = this.db.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?;").get(this.name)
        if (!table['count(*)']) {
            this.db.prepare(`CREATE TABLE ${this.name} (key text PRIMARY KEY, value text)`).run()
            this.db.pragma('synchronous = 1')
            this.db.pragma('journal_mode = wal')
        }
        this.db.prepare(`CREATE TABLE IF NOT EXISTS 'internal::changes::${this.name}' (type TEXT, key TEXT, value TEXT, timestamp INTEGER, pid INTEGER);`).run()
        this.db.prepare(`CREATE TABLE IF NOT EXISTS 'internal::autonum' (enmap TEXT PRIMARY KEY, lastnum INTEGER)`).run()

        this.fetchEverything()
    }

    fetchEverything() {
        const rows = this.db.prepare(`SELECT * FROM ${this.name};`).all()
        for (const row of rows) {
          const val = JSON.parse(row.value)
          super.set(row.key, val)
        }
        return this
    }

    get(key, path = null) {
        if (isNil(key)) return null

        key = key.toString()

        if (!isNil(path)) {
          const data = super.get(key)
          return _get(data, path)
        }

        const data = super.get(key)
        return data
    }

    set(key, val, path = null) {
        if (isNil(key) || !['String', 'Number'].includes(key.constructor.name)) {
          throw new Error('The Database requires keys to be strings or numbers')
        }
        
        key = key.toString()
        let data = super.get(key)
        
        if (!isNil(path)) {
          if (isNil(data)) data = {};
          _set(data, path, val);
        } else {
          data = val;
        }
        
        this.db.prepare(`INSERT OR REPLACE INTO ${this.name} (key, value) VALUES (?, ?);`).run(key, JSON.stringify(data));
        
        return super.set(key, data);
    }

    ensure(key, defaultValue, path = null) {
        if (isNil(defaultValue)) throw new Error(`No default value provided on ensure method for "${key}" in "${this.name}"`);

        if (!isNil(path)) {
          this.ensure(key, {})
          if (this.get(key, path)) return this.get(key, path)
          this.set(key, defaultValue, path)
          return defaultValue
        }

        if (this.get(key)) return this.get(key)

        this.set(key, defaultValue)
        return defaultValue
    }

    delete(key, path = null) {
        if (!isNil(path)) {
            let data = this.get(key)
            path = toPath(path)
            const last = path.pop()
            const propValue = path.length ? _get(data, path) : data
            if (isArray(propValue)) {
                propValue.splice(last, 1)
            } else {
                delete propValue[last]
            }
            if (path.length) {
                _set(data, path, propValue)
            } else {
                data = propValue
            }
            this.set(key, data)
        } else {
            super.delete(key)
            this.db.prepare(`DELETE FROM ${this.name} WHERE key = '${key}'`).run()
            return this
        }
        return this
    }

    deleteAll() {
        this.db.prepare(`DELETE FROM ${this.name};`).run();
        super.clear();
    }

    get indexes() {
        const rows = this.db.prepare(`SELECT key FROM '${this.name}';`).all()
        return rows.map(row => row.key)
    }

}

const game = new Base({ name: 'game' })

game.deleteAll()

console.log(game)
