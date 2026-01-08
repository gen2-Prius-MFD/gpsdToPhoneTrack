import { EventEmitter } from 'events';

export default class extends EventEmitter {
  constructor({distanceThreshold, timeThreshold, speedThreshold} = {}) {
    super();
    this.distanceThreshold = distanceThreshold // meters;
    this.timeThreshold = timeThreshold; // milliseconds
    this.speedThreshold = speedThreshold; // meters/second (ignore slower movement)

    this.lastPoint = null;
    this.lastTriggerTime = 0;
    this.lastMoveTime = 0;
  }

  update(data) {
    const currentDate = data.time ? new Date(data.time) : new Date();
    const currentTime = currentDate.getTime();

    data.time = currentDate

    if (this.lastPoint) {
      const distance = this.#haversineDistance(this.lastPoint, data);
      const deltaTime = currentTime - this.lastTriggerTime;
      const elapsed = (currentTime - this.lastMoveTime) / 1000; // seconds
      const speed = distance / (elapsed || 1); // m/s

      if (distance > this.distanceThreshold || deltaTime > this.timeThreshold || speed > this.speedThreshold) {
        this.emit('move', {
          distance,
          deltaTime,
          speed,
          data
        });

        this.lastTriggerTime = currentTime;
        this.lastMoveTime = currentTime;
      }
    } else {
      this.lastTriggerTime = currentTime;
      this.lastMoveTime = currentTime;
      this.emit('move', {
        distance: 0,
        deltaTime: 0,
        speed: 0,
        data
      });
    }

    this.lastPoint = data;
  }

  #haversineDistance(p1, p2) {
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lon - p1.lon);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon / 2) ** 2;
    const R = 6371000; // Earth radius in meters
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}