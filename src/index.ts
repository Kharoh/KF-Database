import * as fs from 'fs'
import { sep } from 'path'
import _ from 'lodash'
import Database from 'better-sqlite3'

class Base {
  /**
   * The bettersqlite3 database instance
   */
  private database: Database.Database

  /**
   * The map object storing database in memory
   */
  public map?: Map<any, any>

  /**
   * Create a new sqlite database, accessible through simple methods
   */
  constructor(
    /**
     * The name of the database to create
     */
    public readonly name: string,
    /**
     * The options of the database
     */
    public readonly options?: BaseOptions
  ) {
    if (!fs.existsSync('./data')) fs.mkdirSync('./data')
    this.database = new Database(`data${sep}base.sqlite`)

    /* Retrieve the table or create it */
    const table = this.database.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?;").get(this.name)
    if (!table['count(*)']) {
      this.database.prepare(`CREATE TABLE ${this.name} (key text PRIMARY KEY, value text)`).run()
      this.database.pragma('synchronous = 1')
      this.database.pragma('journal_mode = wal')
    }
    this.database.prepare(`CREATE TABLE IF NOT EXISTS 'internal::changes::${this.name}' (type TEXT, key TEXT, value TEXT, timestamp INTEGER, pid INTEGER);`).run()
    this.database.prepare('CREATE TABLE IF NOT EXISTS \'internal::autonum\' (enmap TEXT PRIMARY KEY, lastnum INTEGER)').run()

    /* If the database is not specified to not be in memory, we store it in memory */
    if (options?.inMemory !== false)
      this.fetchEverything()
  }

  /**
   * Fetches every value of the database and store it into the map
   */
  private fetchEverything(): void {
    /* Create the map */
    this.map = new Map()

    /* Retrieve the rows */
    const rows = this.database.prepare(`SELECT * FROM ${this.name};`).all()

    /* Retrieve the values and store them in the map */
    for (const row of rows) {
      const value = JSON.parse(row.value)
      this.map.set(row.key, value)
    }
  }

  /**
   * Get the value object at a given key
   * @param key - The key of the value object to get
   */
  private getValueObjectAtKey(key: string): any {
    /* If database is in memory, return the memory value */
    if (this.map) return this.map.get(key)

    /* Otherwise retrieve the value in the database */
    const possibleValue = this.database.prepare(`SELECT * FROM ${this.name} WHERE key = ?;`).get(key)?.value
    if (possibleValue !== undefined) return JSON.parse(possibleValue)
    return possibleValue
  }

  /**
   * Get a value at a given key following a given path in the database
   * @param key - The key of the value we want to get
   * @param path - The path in the value object
   * @returns The value we want to get or null if there is not
   */
  public get(key: string | number, path?: string | number): any {
    /* Return null if the key is null or undefined */
    if (key === null || key === undefined)
      return null

    /* If the key is a number we convert it to a string */
    if (typeof key === 'number')
      key = key.toString()

    /* Find the value object */
    const valueObject = this.getValueObjectAtKey(key)

    /* If the path is not null or undefined, return the value at the given key and the given path */
    if (path !== null && path !== undefined)
      return _.get(valueObject, path)

    /* Return the value at the given key if there is not path */
    return valueObject
  }

  /**
   * Set a new value at a given key following a given path in the database
   * @param key - The key in the database
   * @param value - The new value to set at this key
   * @param path - The path in the value object
   */
  public set(key: string | number, value: any, path?: string | number): void {
    /* Throws an error if the key is null or undefined or if the key is not a string or a number */
    if (typeof key !== 'string' && typeof key !== 'number')
      throw new Error('The Database requires keys to be strings or numbers')

    /* If the key is a number we convert it to a string */
    if (typeof key === 'number')
      key = key.toString()

    /* We retrieve the current value object stored in the database */
    let valueObject = this.getValueObjectAtKey(key)

    /* If the path is not null or undefined, set the new value at the given path in the value object */
    if (path !== null && path !== undefined) {
      if (valueObject === null || valueObject === undefined)
        valueObject = {}
      _.set(valueObject, path, value)
    }

    /* If there is no path simply set the value at the given key */
    else
      valueObject = value

    /* Save the changes in the database */
    this.database.prepare(`INSERT OR REPLACE INTO ${this.name} (key, value) VALUES (?, ?);`).run(key, JSON.stringify(valueObject))

    /* If there is a map in memory, set the new value */
    this.map?.set(key, valueObject)
  }

  /**
   * Ensure that a value exists in the database while getting it
   * @param key - The key of the value we want to get in the database
   * @param defaultValue - The default value that we will get if there is no value defined
   * @param path - The path we need to follow if the value at the key is an object
   */
  public ensure(key: string | number, defaultValue: any, path?: string | number) {
    /* Throw an error if there was no default value provided */
    if (defaultValue === null || defaultValue === undefined)
      throw new Error(`No default value provided on ensure method for "${key}" in "${this.name}"`)

    /* Return the value at the given key and the given path if there is one */
    const possibleValue = this.get(key, path)
    if (possibleValue)
      return possibleValue

    /* If there is not value at the given and given path, set the new value as the default value and set it in the database */
    if (path !== null && path !== undefined) {
      this.set(key, defaultValue, path)
      return defaultValue
    }

    /* If there is not path, set the data at the given key */
    this.set(key, defaultValue)
    return defaultValue
  }

  /**
   * Delete a value at a given key following a given path in the database
   * @param key - The key of the value to delete in the database
   * @param path - The path we need to follow to delete the value at the end of it
   * @returns Whether or not something was deleted
   */
  public delete(key: string | number, path?: string | number): boolean {
    /* Declare the default return value */
    let hasDeletedSomething = false

    /* If the key is a number we convert it to a string */
    if (typeof key === 'number')
      key = key.toString()

    /* Retrieve the data at the given key */
    const data = this.get(key)

    /* If there is a path, delete the value following the path */
    if (path !== null && path !== undefined) {
      hasDeletedSomething = _.unset(data, path)
      this.set(key, data)
      return hasDeletedSomething
    }

    /* If there is no path, delete the value at the given key */
    if (data) hasDeletedSomething = true
    this.map?.delete(key)
    this.database.prepare(`DELETE FROM ${this.name} WHERE key = ?;`).run(key)
    return hasDeletedSomething
  }

  /**
   * Delete all the values from all the keys of the database
   */
  public deleteAll(): void {
    /* Delete all the values */
    this.database.prepare(`DELETE FROM ${this.name};`).run()

    /* Clear the Map */
    this.map?.clear()
  }

  /**
   * Get all the keys of the database
   * @returns The keys of the database in an array
   */
  get indices(): string[] {
    /* If there is a map, return the keys of the map */
    if (this.map) return [...this.map.keys()]

    /* Retrieve all the rows in the database */
    const rows: any[] = this.database.prepare(`SELECT key FROM '${this.name}';`).all()

    /* Return all the keys */
    return rows.map(row => row.key)
  }
}

export interface BaseOptions {
  /**
   * Whether or not the database is stored in memory using a Map
   */
  inMemory?: boolean
}

export default Base
