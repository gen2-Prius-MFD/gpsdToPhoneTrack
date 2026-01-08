import Database from 'better-sqlite3'
import {randomUUID} from 'crypto'

const dbFile = 'postQueue.db'

export default class SQLiteQueue {
  constructor(config) {
    this.db = new Database(dbFile)

    this.apiUrl = config.traccarUrl
    this.deviceId = config.deviceId
    this.batchSize = config.batchSize
    this.retryInterval = config.postRetryInterval

    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = FULL')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS gps_queue (
        id TEXT PRIMARY KEY,
        timestamp INTEGER,
        lat REAL,
        lon REAL,
        speed REAL,
        altitude REAL,
        accuracy REAL,
        sent INTEGER DEFAULT 0
      );
    `)

    this._timer = null
  }

  enqueue(data) {
    const uuid = randomUUID()
    const stmt = this.db.prepare(`INSERT INTO gps_queue (id, timestamp, lat, lon, speed, altitude, accuracy) VALUES (?, ?, ?, ?, ?, ?)`)
    stmt.run(
      uuid,
      data.timestamp,
      data.lat,
      data.lon,
      data.speed || 0,
      data.altitude || 0,
      data.accuracy || 0,
    )
  }

  _fetchBatch() {
    return this.db.prepare(`SELECT * FROM gps_queue WHERE sent = 0 ORDER BY id LIMIT ?`).all(this.batchSize)
  }

  _markSent(ids) {
    if (ids.length === 0) return

    const placeholders = ids.map(() => '?').join(',')
    this.db.prepare(`UPDATE gps_queue SET sent = 1 WHERE id IN (${placeholders})`).run(...ids)
    this._deleteSent()
  }

  async processOnce() {
    const rows = this._fetchBatch()
    if (rows.length === 0) return;

    const postedRows = (await Promise.all(rows.map(async row=>{
      const res = await fetch(`${this.apiUrl}?id=${this.deviceId}&lat=${row.lat}&lon=${row.lon}&altitude=${row.altitude}&speed=${row.speed}&timestamp=${encodeURIComponent(row.timestamp)}&accuracy=${row.accuracy}`, {
        method: 'POST',
        timeout: 5000
      })

      if (res.ok) return row.id
    }))).filter(a=>typeof a !== 'undefined')

    this._markSent(postedRows)
  }

  start() {
    if (this._timer) return

    this._timer = setInterval(() => {
      this.processOnce()
    }, this.retryInterval)
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  _deleteSent() {
    this.db.prepare(`DELETE FROM gps_queue WHERE sent = 1`).run()
  }

  close() {
    this.stop()
    this._deleteSent()
    this.db.close()
  }
}