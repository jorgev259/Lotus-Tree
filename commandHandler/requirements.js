module.exports = (client, db) => {
  db.prepare(
    'CREATE TABLE IF NOT EXISTS config (guild TEXT, type TEXT, value TEXT, PRIMARY KEY(`guild`,`type`))'
  ).run()
  db.prepare(
    'CREATE TABLE IF NOT EXISTS modules (guild TEXT, module TEXT, state TEXT, PRIMARY KEY(`guild`,`module`))'
  ).run()
  db.prepare(
    'CREATE TABLE IF NOT EXISTS commands (guild TEXT, command TEXT, module TEXT, state TEXT, PRIMARY KEY(`guild`,`command`))'
  ).run()
  db.prepare(
    'CREATE TABLE IF NOT EXISTS perms (guild TEXT, command TEXT, type TEXT, perm TEXT)'
  ).run()
}
