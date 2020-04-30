import * as fs from 'fs'
import { sep } from 'path'
import _ from 'lodash'
import Database from 'better-sqlite3'

/**
 * Initializes the database
 * @param this - The Base execution context
 * @param database - The bettersqlite Database instance
 */
function _init(this: any, database: any): void {
  this.db = database

  const table = this.db.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?;").get(this.name)
  if (!table['count(*)']) {
    this.db.prepare(`CREATE TABLE ${this.name} (key text PRIMARY KEY, value text)`).run()
    this.db.pragma('synchronous = 1')
    this.db.pragma('journal_mode = wal')
  }
  this.db.prepare(`CREATE TABLE IF NOT EXISTS 'internal::changes::${this.name}' (type TEXT, key TEXT, value TEXT, timestamp INTEGER, pid INTEGER);`).run()
  this.db.prepare('CREATE TABLE IF NOT EXISTS \'internal::autonum\' (enmap TEXT PRIMARY KEY, lastnum INTEGER)').run()

  this.fetchEverything()
}

/**
 * Create a Base instance, used to persistently store data in an sqlite driven database
 */
class Base extends Map {

  /**
   * The name of the database
   */
  public readonly name: string

  /**
   * The bettersqlite3 database instance, sqlite driven
   */
  public db: any

  constructor(options: { name: string }) {
    super()

    if (!options) throw new Error('Expected one option argument in the constructor call')
    if (!options.name) throw new Error('You should give a name to your Database')
    this.name = options.name

    if (!fs.existsSync('./data')) fs.mkdirSync('./data')
    const database = new Database(`data${sep}base.sqlite`)

    _init.call(this, database)
  }

  /**
   * Fetches every value in the sqlite database and map them in the parent Class Map
   */
  fetchEverything(): Base {
    const rows = this.db.prepare(`SELECT * FROM ${this.name};`).all()

    for (const row of rows) {
      const val = JSON.parse(row.value)
      super.set(row.key, val)
    }

    return this
  }

  /**
   * Get a value at a given key and a given path in the database
   * @param {(string | number)} key - The key in the database
   * @param {(string | number)} path - The path if the value stored is an array or an object
   * @returns {any} The data stored at the given key and the given path
   */
  get(key: string | number, path?: string | number): any {
    /* Return null if the key is null or undefined */
    if (key === null || key === undefined)
      return null

    /* If the key is a number we convert it to a string */
    if (typeof key === 'number')
      key = key.toString()

    /* If the path is not null or undefined, return the value at the given key and the given path */
    if (path !== null && path !== undefined)
      return _.get(super.get(key), path)

    /* Return the value at the given key */
    return super.get(key)
  }

  /**
   * Set a new value at a given key and a given path in the database
   * @param {(string | number)} key - The key in the database
   * @param {any} value - The new value to set at the given key and path
   * @param {(string | number)} path - The path if the value currently stored is an array or an object
   * @returns {this} The Base instance
   */
  set(key: string | number, value: any, path?: string | number): this {
    /* Throws an error if the key is null or undefined or if the key is not a string or a number */
    if (key === null || key === undefined || (typeof key !== 'string' && typeof key !== 'number'))
      throw new Error('The Database requires keys to be strings or numbers')

    /* If the key is a number we convert it to a string */
    if (typeof key === 'number')
      key = key.toString()

    /* Retrieve the current data stored in the database */
    let data = super.get(key)

    /* If the path is not null or undefined, set the new value at the given key and the given path */
    if (path !== null && path !== undefined) {
      if (data === null || data === undefined)
        _.set(data, path, value)
    }

    /* Otherwise set the new value at the given key */
    else
      data = value

    /* Save the changes in the sqlite database */
    this.db.prepare(`INSERT OR REPLACE INTO ${this.name} (key, value) VALUES (?, ?);`).run(key, JSON.stringify(data))

    /* Return the Map method called */
    return super.set(key, data)
  }

  /**
   * Ensure that a value exists in the database while getting it
   * @param {(string | number)} key - The key in the database
   * @param {any} defaultValue - The default value we want to give to the destination if there is no value
   * @param {(string | number)} path - The path if the value currently stored is an array or an object 
   * @returns {any} The value if there is one or the default value
   */
  ensure(key: string | number, defaultValue: any, path?: string | number): any {
    /* Throw an error if there was no default value provided */
    if (defaultValue === null || defaultValue === undefined)
      throw new Error(`No default value provided on ensure method for "${key}" in "${this.name}"`)

    /* Return the value at the given key and the given path if there is one */
    if (this.get(key, path))
      return this.get(key, path)

    /* If there is no value at the given key and the given path, set the new value based on the default value in the database and return it */
    if (path !== null && path !== undefined) {
      this.ensure(key, {})
      this.set(key, defaultValue, path)
      return defaultValue
    }

    /* If there is no path given and there is data at the given key, return the data */
    if (this.get(key))
      return this.get(key)

    /* If there is no data at the given key, set the data to be de default value and return it */
    this.set(key, defaultValue)
    return defaultValue
  }

  /**
   * Delete a value at a given key and a given path in the database
   * @param {(string | number)} key - The key in the database
   * @param {(string | number)} path - The path if the value currently stored is an array or an object
   * @returns {boolean} - If a value was deleted or not
   */
  delete(key: string | number, path?: string | number): boolean {
    /* Declare a boolean variable to know if something was deleted or not */
    let hasDeletedSomething = false

    /* If there is a path given, delete the value at the given path */
    if (path !== null && path !== undefined) {
      let data = this.get(key)
      hasDeletedSomething = _.unset(data, path)
      this.set(key, data)
    }

    /* If there is no path, delete the value at the given key */
    else {
      hasDeletedSomething = super.delete(key)
      this.db.prepare(`DELETE FROM ${this.name} WHERE key = '${key}'`).run()
      return hasDeletedSomething
    }

    /* Return if something has been deleted or not */
    return hasDeletedSomething
  }

  /**
   * Delete all the values from all the keys of the database
   */
  deleteAll(): void {
    /* Delete all the values in the sqlite database */
    this.db.prepare(`DELETE FROM ${this.name};`).run()

    /* Clear the Map parent Object */
    super.clear()
  }

  /**
   * Get all the keys of the database
   * @returns {string[]} The keys of the database
   */
  get indexes(): string[] {
    /* Retrieve all the rows from the sqlite database */
    const rows: any[] = this.db.prepare(`SELECT key FROM '${this.name}';`).all()

    /* Return all the keys */
    return rows.map(row => row.key)
  }
}

export default Base
