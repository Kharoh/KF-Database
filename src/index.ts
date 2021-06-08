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
  private map?: Map<any, any>

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
    public readonly options: BaseOptions
  ) {
    if (!fs.existsSync('./data')) fs.mkdirSync('./data')
    this.database = new Database(`data${sep}base.sqlite`)

    /* If the database is not specified to not be in memory, we store it in memory */
    if (options.hasMapInMemory !== false)
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
    return this.map ?
      this.map.get(key) :
      this.database.prepare(`SELECT * FROM ${this.name} WHERE key = ${key}`).all()?.[0]?.value
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
    this.database.prepare(`INSERT OR REPLACE INTO ${this.name} (key, value) VALUES (${key}, ${JSON.stringify(valueObject)});`).run()

    /* If there is a map in memory, set the new value */
    this.map?.set(key, valueObject)
  }
}

export interface BaseOptions {
  /**
   * Whether or not the database is stored in memory using a Map
   */
  hasMapInMemory: boolean
}

export default Base
