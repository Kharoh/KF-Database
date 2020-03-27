# KF-Database

A simple database sqlite driven for kf games and more.  

## Getting Started

How to install KF-Database npm package  

### Prerequisites

Simply type in the npm package command installer  

```
npm install kf-database --save
```

## Create the database

### Initialize the database

To run the database, you need to call the constructor with the following params  

```javascript
const Base = require('kf-database')

const database = new Base({ name: 'Your_Database_Name' })
```

## Use the database

### The methods

#### fetchEverything

Retrieve all the data from sqlite database and push it in the Map object  

```javascript
database.fetchEverything()
```

#### get

Get a value from the Map object given the key and a path if it is an *object*  
**Note** : path is optional, key has to be a *string* or a *number*, path needs to be following the model of lodash path  

```javascript
database.get('key', 'path')
```

#### ensure

Get a value from the Map object given the key and a path if it is an *object*, if the value is undefined, return the defaultValue  
**Note** : path is optional, key has to be a *string* or a *number*, path needs to be following the model of lodash path  
**Note** : returning the defaultValue will modify the database

```javascript
database.ensure('key', 'defaultValue', 'path')
```

#### set

Set a value in the Map object given the key and a path if it is an *object*, will modify the database  
**Note** : path is optional, key has to be a *string* or a *number*, path needs to be following the model of lodash path  
**Note** : giving a path when the current value is not an object will erase the current value to create an *object*  

```javascript
database.set('key', 'value', 'path')
```

#### delete

Delete a value in the Map object given the key and the path if it is an *object*  
**Note** : path is optional, key has to be a *string* or a *number*, path needs to be following the model of lodash path  

```javascript
database.delete('key', 'path')
```

#### deleteAll

Delete all values from the Map object  

```javascript
database.deleteAll()
```
