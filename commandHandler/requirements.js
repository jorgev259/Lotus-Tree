const { DataTypes } = require('sequelize')
const { STRING, BOOLEAN } = DataTypes

module.exports = (client, sequelize) => {
  sequelize.define('config', {
    guild: { type: STRING, unique: 'index' },
    item: { type: STRING, unique: 'index' },
    value: DataTypes.STRING
  })

  sequelize.define('module', {
    guild: { type: STRING, unique: 'index' },
    module: { type: STRING, unique: 'index' },
    value: { type: BOOLEAN }
  })

  sequelize.define('command', {
    guild: { type: STRING, unique: 'index' },
    command: { type: STRING, unique: 'index' },
    module: STRING,
    value: { type: BOOLEAN }
  })

  sequelize.define('perm', {
    guild: STRING,
    command: STRING,
    type: STRING,
    perm: STRING
  })
}
