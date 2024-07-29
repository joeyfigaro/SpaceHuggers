/*
    Javascript Space Game
    By Frank Force 2021

*/

import { EngineObject, Timer } from "littlejsengine";

export class GameObject extends EngineObject {
  constructor(pos, size, tileIndex, tileSize, angle) {
    super(pos, size, tileIndex, tileSize, angle);
    this.isGameObject = 1;
    this.health = this.healthMax = 0;
    this.burnDelay = 0.1;
    this.burnTime = 3;
    this.damageTimer = new Timer();
    this.burnDelayTimer = new Timer();
    this.burnTimer = new Timer();
    this.extinguishTimer = new Timer();
    this.color = new Color();
    this.additiveColor = new Color(0, 0, 0, 0);
  }

  inUpdateWindow() {
    return (
      levelWarmup ||
      isOverlapping(this.pos, this.size, cameraPos, updateWindowSize)
    );
  }

  update() {
    if (
      this.parent ||
      this.persistent ||
      !this.groundObject ||
      this.inUpdateWindow()
    )
      // pause physics if outside update window
      super.update();

    if (!this.isLavaRock) {
      if (!this.isDead() && this.damageTimer.isSet()) {
        // flash white when damaged
        const a = 0.5 * percent(this.damageTimer.get(), 0, 0.15);
        this.additiveColor = new Color(a, a, a, 0);
      } else this.additiveColor = new Color(0, 0, 0, 0);
    }

    if (!this.parent && this.pos.y < -1) {
      // kill and destroy if fall below level
      this.kill();
      this.persistent || this.destroy();
    } else if (this.burnTime) {
      if (this.burnTimer.isSet()) {
        // burning
        if (this.burnTimer.elapsed()) {
          this.kill();
          if (this.fireEmitter) this.fireEmitter.emitRate = 0;
        } else if (rand() < 0.01) {
          // random chance to spread fire
          const spreadRadius = 2;
          debugFire && debugCircle(this.pos, spreadRadius, "#f00", 1);
          forEachObject(
            this.pos,
            spreadRadius,
            o => o.isGameObject && o.burn(),
          );
        }
      } else if (this.burnDelayTimer.elapsed()) {
        // finished waiting to burn
        this.burn(1);
      }
    }
  }

  render() {
    drawTile(
      this.pos,
      this.size,
      this.tileIndex,
      this.tileSize,
      this.color.scale(this.burnColorPercent(), 1),
      this.angle,
      this.mirror,
      this.additiveColor,
    );
  }

  burnColorPercent() {
    return lerp(this.burnTimer.getPercent(), 0.2, 1);
  }

  burn(instant) {
    if (
      !this.canBurn ||
      this.burnTimer.isSet() ||
      this.extinguishTimer.active()
    )
      return;

    if (godMode && this.isPlayer) return;

    if (this.team == team_player) {
      // safety window after spawn
      if (godMode || this.getAliveTime() < 2) return;
    }

    if (instant) {
      this.burnTimer.set(this.burnTime * rand(1.5, 1));
      this.fireEmitter = makeFire();
      this.addChild(this.fireEmitter);
    } else
      this.burnDelayTimer.isSet() ||
        this.burnDelayTimer.set(this.burnDelay * rand(1.5, 1));
  }

  extinguish() {
    if (this.fireEmitter && this.fireEmitter.emitRate == 0) return;

    // stop burning
    this.extinguishTimer.set(0.1);
    this.burnTimer.unset();
    this.burnDelayTimer.unset();
    if (this.fireEmitter) this.fireEmitter.destroy();
    this.fireEmitter = 0;
  }

  heal(health) {
    assert(health >= 0);
    if (this.isDead()) return 0;

    // apply healing and return amount healed
    return (
      this.health - (this.health = min(this.health + health, this.healthMax))
    );
  }

  damage(damage, damagingObject) {
    ASSERT(damage >= 0);
    if (this.isDead()) return 0;

    // set damage timer;
    this.damageTimer.set();
    for (const child of this.children)
      child.damageTimer && child.damageTimer.set();

    // apply damage and kill if necessary
    const newHealth = max(this.health - damage, 0);
    if (!newHealth) this.kill(damagingObject);

    // set new health and return amount damaged
    return this.health - (this.health = newHealth);
  }

  isDead() {
    return !this.health;
  }
  kill(damagingObject) {
    this.destroy();
  }

  collideWithObject(o) {
    if (o.isLavaRock && this.canBurn) {
      if (levelWarmup) {
        this.destroy();
        return 1;
      }
      this.burn();
    }
    return 1;
  }
}

///////////////////////////////////////////////////////////////////////////////

const propType_crate_wood = 0;
const propType_crate_explosive = 1;
const propType_crate_metal = 2;
const propType_barrel_explosive = 3;
const propType_barrel_water = 4;
const propType_barrel_metal = 5;
const propType_barrel_highExplosive = 6;
const propType_rock = 7;
const propType_rock_lava = 8;
const propType_count = 9;

export class Prop extends GameObject {
  constructor(pos, typeOverride) {
    super(pos);

    const type = (this.type =
      typeOverride != undefined
        ? typeOverride
        : (rand() ** 2 * propType_count) | 0);
    let health = 5;
    this.tileIndex = 16;
    this.explosionSize = 0;
    if (this.type == propType_crate_wood) {
      this.color = new Color(1, 0.5, 0);
      this.canBurn = 1;
    } else if (this.type == propType_crate_metal) {
      this.color = new Color(0.9, 0.9, 1);
      health = 10;
    } else if (this.type == propType_crate_explosive) {
      this.color = new Color(0.2, 0.8, 0.2);
      this.canBurn = 1;
      this.explosionSize = 2;
      health = 1e3;
    } else if (this.type == propType_barrel_metal) {
      this.tileIndex = 17;
      this.color = new Color(0.9, 0.9, 1);
      health = 10;
    } else if (this.type == propType_barrel_explosive) {
      this.tileIndex = 17;
      this.color = new Color(0.2, 0.8, 0.2);
      this.canBurn = 1;
      this.explosionSize = 2;
      health = 1e3;
    } else if (this.type == propType_barrel_highExplosive) {
      this.tileIndex = 17;
      this.color = new Color(1, 0.1, 0.1);
      this.canBurn = 1;
      this.explosionSize = 3;
      this.burnTimeDelay = 0;
      this.burnTime = rand(0.5, 0.1);
      health = 1e3;
    } else if (this.type == propType_barrel_water) {
      this.tileIndex = 17;
      this.color = new Color(0, 0.6, 1);
      health = 0.01;
    } else if (this.type == propType_rock || this.type == propType_rock_lava) {
      this.tileIndex = 18;
      this.color = new Color(0.8, 0.8, 0.8).mutate(0.2);
      health = 30;
      this.mass *= 4;
      if (rand() < 0.2) {
        health = 99;
        this.mass *= 4;
        this.size = this.size.scale(2);
        this.pos.y += 0.5;
      }
      this.isCrushing = 1;

      if (this.type == propType_rock_lava) {
        this.color = new Color(1, 0.9, 0);
        this.additiveColor = new Color(1, 0, 0);
        this.isLavaRock = 1;
      }
    }

    // randomly angle and flip axis (90 degree rotation)
    this.angle = ((rand(4) | 0) * PI) / 2;
    if (rand() < 0.5) this.size = this.size.flip();

    this.mirror = rand() < 0.5;
    this.health = this.healthMax = health;
    this.setCollision(1, 1);
  }

  update() {
    const oldVelocity = this.velocity.copy();
    super.update();

    // apply collision damage
    const deltaSpeedSquared = this.velocity
      .subtract(oldVelocity)
      .lengthSquared();
    deltaSpeedSquared > 0.05 && this.damage(2 * deltaSpeedSquared);
  }

  damage(damage, damagingObject) {
    (this.explosionSize ||
      (this.type == propType_crate_wood && rand() < 0.1)) &&
      this.burn();
    super.damage(damage, damagingObject);
  }

  kill() {
    if (this.destroyed) return;

    if (this.type == propType_barrel_water) makeWater(this.pos);

    this.destroy();
    makeDebris(this.pos, this.color.scale(this.burnColorPercent(), 1));

    this.explosionSize
      ? explosion(this.pos, this.explosionSize)
      : playSound(sound_destroyTile, this.pos);
  }
}

///////////////////////////////////////////////////////////////////////////////

export let activeCheckpoint;
export let checkpointTimer = new Timer();

export class Checkpoint extends GameObject {
  constructor(pos) {
    super(pos.int().add(vec2(0.5)));
    this.renderOrder = tileRenderOrder - 1;
    this.isCheckpoint = 1;
    for (let x = 3; x--; )
      for (let y = 6; y--; )
        setTileCollisionData(
          pos.subtract(vec2(x - 1, 1 - y)),
          y ? tileType_empty : tileType_solid,
        );
  }

  update() {
    if (!this.inUpdateWindow()) return; // ignore offscreen objects

    // check if player is near
    for (const player of players)
      player &&
        !player.isDead() &&
        this.pos.distanceSquared(player.pos) < 1 &&
        this.setActive();
  }

  setActive() {
    if (activeCheckpoint != this && !levelWarmup)
      playSound(sound_checkpoint, this.pos);

    checkpointPos = this.pos;
    activeCheckpoint = this;
    checkpointTimer.set(0.1);
  }

  render() {
    // draw flag
    const height = 4;
    const color = activeCheckpoint == this ? new Color(1, 0, 0) : new Color();
    const a = Math.sin(time * 4 + this.pos.x);
    drawTile(
      this.pos.add(vec2(0.5, height - 0.3 - 0.5 - 0.03 * a)),
      vec2(1, 0.6),
      14,
      undefined,
      color,
      a * 0.06,
    );
    drawRect(
      this.pos.add(vec2(0, height / 2 - 0.5)),
      vec2(0.1, height),
      new Color(0.9, 0.9, 0.9),
    );
  }
}

///////////////////////////////////////////////////////////////////////////////

export class Grenade extends GameObject {
  constructor(pos) {
    super(pos, vec2(0.2), 5, vec2(8));

    this.health = this.healthMax = 1e3;
    this.beepTimer = new Timer(1);
    this.elasticity = 0.3;
    this.friction = 0.9;
    this.angleDamping = 0.96;
    this.renderOrder = 1e8;
    this.setCollision();
  }

  update() {
    super.update();

    if (this.getAliveTime() > 3) {
      explosion(this.pos, 3);
      this.destroy();
      return;
    }

    if (this.beepTimer.elapsed()) {
      playSound(sound_grenade, this.pos);
      this.beepTimer.set(1);
    }

    alertEnemies(this.pos, this.pos);
  }

  render() {
    drawTile(
      this.pos,
      vec2(0.5),
      this.tileIndex,
      this.tileSize,
      this.color,
      this.angle,
    );

    const a = this.getAliveTime();
    setBlendMode(1);
    drawTile(
      this.pos,
      vec2(2),
      0,
      vec2(16),
      new Color(1, 0, 0, 0.2 - 0.2 * Math.cos(a * 2 * PI)),
    );
    drawTile(
      this.pos,
      vec2(1),
      0,
      vec2(16),
      new Color(1, 0, 0, 0.2 - 0.2 * Math.cos(a * 2 * PI)),
    );
    drawTile(
      this.pos,
      vec2(0.5),
      0,
      vec2(16),
      new Color(1, 1, 1, 0.2 - 0.2 * Math.cos(a * 2 * PI)),
    );
    setBlendMode(0);
  }
}

///////////////////////////////////////////////////////////////////////////////

export class Weapon extends EngineObject {
  constructor(pos, parent) {
    super(pos, vec2(0.6), 4, vec2(8));

    // weapon settings
    this.isWeapon = 1;
    this.fireTimeBuffer = this.localAngle = 0;
    this.recoilTimer = new Timer();

    this.addChild(
      (this.shellEmitter = new ParticleEmitter(
        vec2(),
        0,
        0,
        0,
        0.1, // pos, emitSize, emitTime, emitRate, emiteCone
        undefined,
        undefined, // tileIndex, tileSize
        new Color(1, 0.8, 0.5),
        new Color(0.9, 0.7, 0.5), // colorStartA, colorStartB
        new Color(1, 0.8, 0.5),
        new Color(0.9, 0.7, 0.5), // colorEndA, colorEndB
        3,
        0.1,
        0.1,
        0.15,
        0.1, // particleTime, sizeStart, sizeEnd, particleSpeed, particleAngleSpeed
        1,
        0.95,
        1,
        0,
        0, // damping, angleDamping, gravityScale, particleCone, fadeRate,
        0.1,
        1, // randomness, collide, additive, randomColorLinear, renderOrder
      )),
    );
    this.shellEmitter.elasticity = 0.5;
    this.shellEmitter.particleDestroyCallback =
      persistentParticleDestroyCallback;
    this.renderOrder = parent.renderOrder + 1;

    parent.weapon = this;
    parent.addChild(this, (this.localOffset = vec2(0.55, 0)));
  }

  update() {
    super.update();

    const fireRate = 8;
    const bulletSpeed = 0.5;
    const spread = 0.1;

    this.mirror = this.parent.mirror;
    this.fireTimeBuffer += timeDelta;

    if (this.recoilTimer.active())
      this.localAngle = lerp(this.recoilTimer.getPercent(), 0, this.localAngle);

    if (this.triggerIsDown) {
      // slow down enemy bullets
      const speed = bulletSpeed * (this.parent.isPlayer ? 1 : 0.5);
      const rate = 1 / fireRate;
      for (; this.fireTimeBuffer > 0; this.fireTimeBuffer -= rate) {
        this.localAngle = -rand(0.2, 0.15);
        this.recoilTimer.set(rand(0.4, 0.3));
        const bullet = new Bullet(this.pos, this.parent);
        const direction = vec2(this.getMirrorSign(speed), 0);
        bullet.velocity = direction.rotate(rand(spread, -spread));

        this.shellEmitter.localAngle = -0.8 * this.getMirrorSign();
        this.shellEmitter.emitParticle();
        playSound(sound_shoot, this.pos);

        // alert enemies
        this.parent.isPlayer && alertEnemies(this.pos, this.pos);
      }
    } else this.fireTimeBuffer = min(this.fireTimeBuffer, 0);
  }
}

///////////////////////////////////////////////////////////////////////////////

export class Bullet extends EngineObject {
  constructor(pos, attacker) {
    super(pos, vec2(0));
    this.color = new Color(1, 1, 0, 1);
    this.lastVelocity = this.velocity;
    this.setCollision();

    this.damage = this.damping = 1;
    this.gravityScale = 0;
    this.attacker = attacker;
    this.team = attacker.team;
    this.renderOrder = 1e9;
    this.range = 8;
  }

  update() {
    this.lastVelocity = this.velocity;
    super.update();

    this.range -= this.velocity.length();
    if (this.range < 0) {
      const emitter = new ParticleEmitter(
        this.pos,
        0.2,
        0.1,
        100,
        PI, // pos, emitSize, emitTime, emitRate, emiteCone
        0,
        undefined, // tileIndex, tileSize
        new Color(1, 1, 0, 0.5),
        new Color(1, 1, 1, 0.5), // colorStartA, colorStartB
        new Color(1, 1, 0, 0),
        new Color(1, 1, 1, 0), // colorEndA, colorEndB
        0.1,
        0.5,
        0.1,
        0.1,
        0.1, // particleTime, sizeStart, sizeEnd, particleSpeed, particleAngleSpeed
        1,
        1,
        0.5,
        PI,
        0.1, // damping, angleDamping, gravityScale, particleCone, fadeRate,
        0.5,
        0,
        1, // randomness, collide, additive, randomColorLinear, renderOrder
      );

      this.destroy();
      return;
    }

    // check if hit someone
    forEachObject(this.pos, this.size, o => {
      if (o.isGameObject && !o.parent && o.team != this.team)
        if (!o.dodgeTimer || !o.dodgeTimer.active()) this.collideWithObject(o);
    });
  }

  collideWithObject(o) {
    if (o.isGameObject) {
      o.damage(this.damage, this);
      o.applyForce(this.velocity.scale(0.1));
      if (o.isCharacter) {
        playSound(sound_walk, this.pos);
        this.destroy();
      } else this.kill();
    }

    return 1;
  }

  collideWithTile(data, pos) {
    if (data <= 0) return 0;

    const destroyTileChance =
      data == tileType_glass ? 1 : data == tileType_dirt ? 0.2 : 0.05;
    rand() < destroyTileChance && destroyTile(pos);
    this.kill();

    return 1;
  }

  kill() {
    if (this.destroyed) return;

    const emitter = new ParticleEmitter(
      this.pos,
      0,
      0.1,
      100,
      0.5, // pos, emitSize, emitTime, emitRate, emiteCone
      undefined,
      undefined, // tileIndex, tileSize
      new Color(1, 1, 0),
      new Color(1, 0, 0), // colorStartA, colorStartB
      new Color(1, 1, 0),
      new Color(1, 0, 0), // colorEndA, colorEndB
      0.2,
      0.2,
      0,
      0.1,
      0.1, // particleTime, sizeStart, sizeEnd, particleSpeed, particleAngleSpeed
      1,
      1,
      0.5,
      PI,
      0.1, // damping, angleDamping, gravityScale, particleCone, fadeRate,
      0.5,
      1,
      1, // randomness, collide, additive, randomColorLinear, renderOrder
    );
    emitter.trailScale = 1;
    emitter.angle = this.lastVelocity.angle() + PI;
    emitter.elasticity = 0.3;

    this.destroy();
  }

  render() {
    drawRect(
      this.pos,
      vec2(0.4, 0.5),
      new Color(1, 1, 1, 0.5),
      this.velocity.angle(),
    );
    drawRect(this.pos, vec2(0.2, 0.5), this.color, this.velocity.angle());
  }
}
