let particles = [];
let gravityCenter;
let orbs = []; // 생성된 원들을 저장
const G = 1500; // 중력 상수
const baseDecayInterval = 30; // 기본 수명 감소 간격(ms)
const fadeTrailLength = 10; // 잔상으로 보이는 수명 범위

class Orb {
  constructor(x, y, particleCount) {
    this.pos = createVector(x, y);
    this.size = map(particleCount, 10, 40, 15, 60);
    this.size = constrain(this.size, 15, 60);
    
    // 노란색~푸른색 사이 랜덤 색상
    const colorT = random(1);
    this.color = {
      r: lerp(255, 100, colorT),
      g: lerp(220, 150, colorT),
      b: lerp(100, 255, colorT)
    };
    
    // 크기에 비례한 중력 상수
    this.gravityStrength = map(this.size, 15, 60, 500, 1500);
    
    // 소멸에 필요한 입자 개수 (흡수 카운터)
    this.requiredParticles = floor(map(this.size, 15, 60, 15, 50));
    this.absorbedParticles = 0; // 흡수한 입자 개수
    
    // 페이드 효과를 위한 속성
    this.createdTime = millis();
    this.fadeInDuration = 500; // 페이드인 시간 (ms)
    this.alpha = 0; // 현재 투명도
    this.isDying = false;
    this.deathStartTime = 0;
    this.fadeOutDuration = 300; // 페이드아웃 시간 (ms)
  }
  
  update() {
    const currentTime = millis();
    
    // 페이드인 효과
    if (!this.isDying) {
      const timeSinceCreation = currentTime - this.createdTime;
      this.alpha = constrain(map(timeSinceCreation, 0, this.fadeInDuration, 0, 1), 0, 1);
    } else {
      // 페이드아웃 효과
      const timeSinceDeath = currentTime - this.deathStartTime;
      this.alpha = constrain(map(timeSinceDeath, 0, this.fadeOutDuration, 1, 0), 0, 1);
    }
  }
  
  display() {
    // 흡수 진행도에 따른 알파 조정 (100% -> 40%)
    const absorptionProgress = this.absorbedParticles / this.requiredParticles;
    const absorptionAlpha = map(absorptionProgress, 0, 1, 1, 0.4);
    const finalAlpha = this.alpha * absorptionAlpha;
    
    // 글로우 효과 (외곽 발광)
    const glowSteps = 8;
    for (let i = glowSteps; i > 0; i--) {
      const glowAlpha = map(i, glowSteps, 0, 0, 30) * finalAlpha;
      const glowSize = this.size * 2 + i * 4;
      
      // 채도를 높인 색상
      fill(
        min(this.color.r * 1.2, 255),
        min(this.color.g * 1.2, 255),
        min(this.color.b * 1.2, 255),
        glowAlpha
      );
      noStroke();
      circle(this.pos.x, this.pos.y, glowSize);
    }
    
    // radial gradient 효과 (중심이 불투명, 외곽이 투명)
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const alpha = map(i, 0, steps, 0, 50) * finalAlpha;
      fill(this.color.r, this.color.g, this.color.b, alpha);
      noStroke();
      circle(this.pos.x, this.pos.y, (this.size / steps) * (steps - i) * 2);
    }
    
    // 아웃라인
    noFill();
    stroke(this.color.r, this.color.g, this.color.b, 200 * finalAlpha);
    strokeWeight(2);
    circle(this.pos.x, this.pos.y, this.size * 2);
    
    // 중력장 시각화 (페이드인이 완료된 후)
    if (this.alpha > 0.8) {
      this.drawGravityField(this.pos.x, this.pos.y, this.color, this.gravityStrength, 0.3+finalAlpha);
    }
  }
  
  // 중력장 그리기 함수 (마우스와 원이 동일하게 사용)
  drawGravityField(x, y, color, strength, alphaMultiplier) {
    const maxRadius = map(strength, 500, 1500, 250, 600);
    let r = this.size * 2 + 30;
    
    noFill();
    strokeWeight(1);
    
    while (r < maxRadius) {
      // 거리에 반비례하는 불투명도 (50% -> 20%)
      const distanceAlpha = map(r, this.size * 2, maxRadius, 70, 20);
      stroke(color.r, color.g, color.b, distanceAlpha * alphaMultiplier);
      circle(x, y, r);
      
      // 급수적 증가 (1.5배씩)
      r *= 1.5;
    }
  }
  
  canCheckCollision() {
    // 생성 후 4000ms 이후부터만 충돌 체크
    return millis() - this.createdTime > 4000;
  }
  
  startDeath() {
    if (!this.isDying) {
      this.isDying = true;
      this.deathStartTime = millis();
    }
  }
  
  isFullyDead() {
    if (!this.isDying) return false;
    return millis() - this.deathStartTime >= this.fadeOutDuration;
  }
  
  // 입자 흡수 (반경 7px 내 입자를 카운터로 집계)
  absorbParticle() {
    this.absorbedParticles++;
    
    // 필요한 개수만큼 흡수했으면 소멸 시작
    if (this.absorbedParticles >= this.requiredParticles) {
      this.startDeath();
    }
  }
  
  // 입자가 흡수 범위 내에 있는지 체크
  isInAbsorptionRange(particlePos) {
    if (!this.canCheckCollision() || this.isDying) return false;
    const d = dist(this.pos.x, this.pos.y, particlePos.x, particlePos.y);
    return d < 7;
  }
}

class Particle {
  constructor() {
    // 캔버스 가장자리 랜덤 위치에서 생성
    const edge = floor(random(4));
    if (edge === 0) { // 상단
      this.pos = createVector(random(width), 0);
    } else if (edge === 1) { // 우측
      this.pos = createVector(width, random(height));
    } else if (edge === 2) { // 하단
      this.pos = createVector(random(width), height);
    } else { // 좌측
      this.pos = createVector(0, random(height));
    }

    // 랜덤한 초기 방향
    const angle = random(TWO_PI);
    const speed = random(1, 3);
    this.vel = createVector(cos(angle) * speed, sin(angle) * speed);
    this.acc = createVector(0, 0);
    
    this.lifespan = 100;
    this.lastDecayTime = millis();
    this.decayInterval = baseDecayInterval;
    
    // 과거 위치를 저장 (잔상 효과용)
    this.history = [];
    
    // 페이드아웃 효과
    this.isDying = false;
    this.deathStartTime = 0;
    this.fadeOutDuration = 200; // 페이드아웃 시간 (ms)
    this.deathAlpha = 1; // 사망 시 투명도
    
    // 최적화: 렌더링 빈도 제어
    this.lastRenderTime = 0;
    this.renderInterval = 200; // 기본 렌더링 간격 (ms)
  }

  applyForce(force) {
    this.acc.add(force);
  }
  
  startDeath() {
    if (!this.isDying) {
      this.isDying = true;
      this.deathStartTime = millis();
    }
  }
  
  isFullyDead() {
    if (this.isDying) {
      return millis() - this.deathStartTime >= this.fadeOutDuration;
    }
    // 캔버스 밖으로 나간 경우만 즉시 제거
    return this.pos.x < -50 || this.pos.x > width + 50 ||
           this.pos.y < -50 || this.pos.y > height + 50;
  }

  // 중력원 근처에 있는지 체크 - 제거 (더 이상 필요 없음)
  
  // 렌더링 가능한지 체크 - 제거 (항상 렌더링)
  shouldRender() {
    return true; // 최적화를 위해 항상 렌더링
  }

  update() {
    // 페이드아웃 중이면 투명도만 업데이트
    if (this.isDying) {
      const timeSinceDeath = millis() - this.deathStartTime;
      this.deathAlpha = constrain(map(timeSinceDeath, 0, this.fadeOutDuration, 1, 0), 0, 1);
      return;
    }
    
    // 원 흡수 범위 체크 (먼저 체크)
    for (let orb of orbs) {
      if (orb.isInAbsorptionRange(this.pos)) {
        orb.absorbParticle();
        // 페이드아웃 효과를 위해 startDeath 호출
        this.startDeath();
        return;
      }
    }
    
    // 중력원이 존재할 때만 중력 계산
    if (gravityCenter) {
      const gravityForce = p5.Vector.sub(gravityCenter, this.pos);
      const distance = gravityForce.mag();
      const strength = G / (distance * distance);
      gravityForce.setMag(strength);
      
      const gravityMagnitude = strength * 100;
      this.decayInterval = baseDecayInterval + gravityMagnitude * 5;

      this.applyForce(gravityForce);
    }
    
    // 생성된 원들의 중력 계산
    for (let orb of orbs) {
      if (orb.isDying) continue; // 죽어가는 원은 중력 무시
      
      const gravityForce = p5.Vector.sub(orb.pos, this.pos);
      const distance = gravityForce.mag();
      const strength = orb.gravityStrength / (distance * distance);
      gravityForce.setMag(strength);
      
      const gravityMagnitude = strength * 100;
      this.decayInterval = baseDecayInterval + gravityMagnitude * 5;

      this.applyForce(gravityForce);
    }

    // 속도와 위치 업데이트
    this.vel.add(this.acc);
    this.vel.limit(6);
    this.pos.add(this.vel);
    this.acc.mult(0);

    // 현재 위치와 수명을 history에 저장
    this.history.push({
      pos: this.pos.copy(),
      lifespan: this.lifespan
    });

    // 수명이 (현재 수명 + fadeTrailLength) 이하인 것만 유지
    this.history = this.history.filter(h => 
      h.lifespan <= this.lifespan + fadeTrailLength
    );

    // 수명 감소
    const currentTime = millis();
    if (currentTime - this.lastDecayTime >= this.decayInterval) {
      this.lifespan -= 1;
      this.lastDecayTime = currentTime;
    }
    
    // 수명이 0이 되면 페이드아웃 시작
    if (this.lifespan <= 0) {
      this.startDeath();
    }
  }

  display() {
    // 잔상 효과: history에 저장된 과거 위치들을 입자로 그림
    for (let i = 0; i < this.history.length; i++) {
      const h = this.history[i];
      
      // 당시 수명에 따라 색상 결정
      const col = this.getColorByLifespan(h.lifespan);
      
      // history 배열의 인덱스에 따라 투명도 계산
      const alpha = map(i, 0, this.history.length - 1, 50, 200) * this.deathAlpha;
      
      // 잔상 크기
      const size = map(i, 0, this.history.length - 1, 2, 4);
      
      // 글로우 효과
      const glowSteps = 3;
      for (let g = glowSteps; g > 0; g--) {
        const glowAlpha = map(g, glowSteps, 0, 0, alpha * 0.3);
        fill(
          min(col.r * 1.3, 255),
          min(col.g * 1.3, 255),
          min(col.b * 1.3, 255),
          glowAlpha
        );
        noStroke();
        circle(h.pos.x, h.pos.y, size + g * 2);
      }
      
      // 메인 입자
      fill(col.r, col.g, col.b, alpha);
      noStroke();
      circle(h.pos.x, h.pos.y, size);
    }

    // 현재 입자 글로우 효과
    const currentCol = this.getColorByLifespan(this.lifespan);
    const glowSteps = 5;
    for (let g = glowSteps; g > 0; g--) {
      const glowAlpha = map(g, glowSteps, 0, 0, 60) * this.deathAlpha;
      fill(
        min(currentCol.r * 1.3, 255),
        min(currentCol.g * 1.3, 255),
        min(currentCol.b * 1.3, 255),
        glowAlpha
      );
      noStroke();
      circle(this.pos.x, this.pos.y, 5 + g * 2);
    }
    
    // 현재 입자 (가장 밝고 큼)
    fill(currentCol.r, currentCol.g, currentCol.b, 255 * this.deathAlpha);
    noStroke();
    circle(this.pos.x, this.pos.y, 5);
  }

  // 수명에 따라 색상 반환: 100(노랑) -> 50(파랑) -> 0(회색)
  getColorByLifespan(life) {
    if (life > 50) {
      // 100 -> 50: 노란색에서 파란색으로
      const t = map(life, 50, 100, 0, 1);
      return {
        r: lerp(100, 255, t),
        g: lerp(150, 220, t),
        b: lerp(255, 100, t)
      };
    } else {
      // 50 -> 0: 파란색에서 회색으로
      const t = map(life, 0, 50, 0, 1);
      return {
        r: lerp(120, 100, t),
        g: lerp(120, 150, t),
        b: lerp(120, 255, t)
      };
    }
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  gravityCenter = null;
}

function draw() {
  background(10, 10, 20);

  // 중력원 표시 (존재할 때만)
  if (gravityCenter) {
    stroke(255, 200, 50, 150);
    noFill();
    circle(gravityCenter.x, gravityCenter.y, 40);
    
    // 중력장 시각화
    
    let r=70
    noFill();
    strokeWeight(1);
    
    while (r<600) {
      const distanceAlpha = map(r, 40, 600, 70, 20);
      stroke(255,200,50, distanceAlpha);
      circle(gravityCenter.x, gravityCenter.y,r);
      r*=1.5;
    }
    
//    noFill();
//    stroke(255, 200, 50, 30);
//    strokeWeight(1);
//    for (let r = 50; r < 400; r += 50) {
//      circle(gravityCenter.x, gravityCenter.y, r * 2);
//    }
  }
  
  // 생성된 원들 업데이트 및 표시
  for (let i = orbs.length - 1; i >= 0; i--) {
    orbs[i].update();
    orbs[i].display();
    
    // 페이드아웃이 완료된 원 제거
    if (orbs[i].isFullyDead()) {
      orbs.splice(i, 1);
    }
  }

  // 새 입자 생성
  if (random(1) < 0.4 && particles.length < 150) {
    particles.push(new Particle());
  }

  // 입자 업데이트 및 표시
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display(); // 항상 렌더링

    // 페이드아웃이 완료되거나 캔버스 밖으로 나간 입자 제거
    if (particles[i].isFullyDead()) {
      particles.splice(i, 1);
    }
  }


}

function mousePressed() {
  gravityCenter = createVector(mouseX, mouseY);
}

function mouseDragged() {
  gravityCenter = createVector(mouseX, mouseY);
}

function mouseReleased() {
  // 마우스 위치 근처의 입자 개수 확인
  let nearbyParticles = [];
  for (let i = 0; i < particles.length; i++) {
    const d = dist(mouseX, mouseY, particles[i].pos.x, particles[i].pos.y);
    if (d < 6) {
      nearbyParticles.push(i);
    }
  }
  
  // 10개 이상이면 원 생성
  if (nearbyParticles.length >= 10) {
    orbs.push(new Orb(mouseX, mouseY, nearbyParticles.length));
    
    // 해당 입자들 제거
    for (let i = nearbyParticles.length - 1; i >= 0; i--) {
      particles.splice(nearbyParticles[i], 1);
    }
  }
  
  gravityCenter = null;
}