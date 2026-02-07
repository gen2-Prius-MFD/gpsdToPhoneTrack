import Gpsd from './utils/gpsd/client.mjs'
import detectMovement  from './utils/detectMovement.mjs';
import Queue from './utils/postQueueSqlite.mjs'

const configFromArgs = Object.fromEntries(process.argv.slice(2).filter((_, index) => index % 2 === 0).map((key, index) => [key.replace(/^--/, ''), process.argv.slice(2)[index * 2 + 1]]))

const tracker = new detectMovement({
  distanceThreshold: Number(configFromArgs.distanceThreshold),
  timeThreshold: Number(configFromArgs.timeThreshold),
  speedThreshold: Number(configFromArgs.speedThreshold)
});
const client = new Gpsd({
  port: 2947,
  hostname: 'localhost'
})
const queue = new Queue(configFromArgs)


client.on('connected', () => {
  console.log('Gpsd connected')
  queue.start()
  client.watch({
    class: 'WATCH',
    json: true,
    scaled: true
  })
})
client.on('error', err => console.log(`Gpsd error: ${err.error}`))
client.on('TPV', a => tracker.update(a))

tracker.on('move', async(data) => {
  queue.enqueue({
    lat: data.data.lat,
    lon: data.data.lon,
    speed: data.data.speed || 0,
    altitude: data.data.alt || 0,
    accuracy: data.data.eph || 0,
    timestamp: data.data.time.getTime()
  })
});

client.connect()

async function cleanup() {
  console.log('Cleaning up before shutdown...');
  queue.close()
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);