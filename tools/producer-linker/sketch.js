// --- Globals ---
let faces = [];
let topics = [];
let particles = [];
let canvas;

// --- Sound Effect Globals ---
let noise, noiseEnv, osc, oscEnv;
// Sound for error/fail state
let oscFail, oscFailEnv;
let soundInitialized = false;
let notes = [110.00, 130.81, 146.83, 164.81, 196.00, 220.00]; // A2, C3, D3, E3, G3, A3

// Interaction
let draggedObject = null; // object being dragged
let shakeAmount = 0; // screen shake

// Array for "zap" link effects
let zaps = [];

// Constants
const FACE_SIZE = 80; // diameter of the face image
const TOPIC_HEIGHT = 30;
const PARTICLE_COUNT = 30;

// --- p5.js Setup ---
function setup() {
  canvas = createCanvas(800, 500);
  canvas.parent('canvas-container');

  pixelDensity(1);
  frameRate(60);
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  rectMode(CENTER);

  // UI listeners
  document.getElementById('upload-face').addEventListener('change', (event) => {
    if (event.target.files && event.target.files[0]) {
      let file = event.target.files[0];
      let reader = new FileReader();
      reader.onload = (e) => {
        loadImage(e.target.result, (loadedImg) => {
          faces.push(new Face(loadedImg));
        });
      };
      reader.readAsDataURL(file);
    }
  });

  select('#add-topic').mousePressed(addTopic);
  select('#topic-input').elt.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') addTopic();
  });

  select('#link-button').mousePressed(linkRandom);
  select('#reset-button').mousePressed(resetLinks);
  select('#remove-button').mousePressed(removeLast);
}

// --- p5.js Draw Loop ---
function draw() {
  // Screen shake
  push();
  if (shakeAmount > 0) {
    translate(random(-shakeAmount, shakeAmount), random(-shakeAmount, shakeAmount));
    shakeAmount -= 1;
  }

  // Background static
  drawStatic();

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isDead()) particles.splice(i, 1);
  }

  // Zap effects
  for (let i = zaps.length - 1; i >= 0; i--) {
    drawZap(zaps[i]);
    zaps[i].life--;
    if (zaps[i].life <= 0) zaps.splice(i, 1);
  }

  // Hover checks
  let somethingIsHovered = false;
  for (let i = topics.length - 1; i >= 0; i--) if (topics[i].checkHover()) somethingIsHovered = true;
  for (let i = faces.length - 1; i >= 0; i--) if (!somethingIsHovered && faces[i].checkHover()) somethingIsHovered = true;

  // Cursor style
  if (draggedObject) canvas.style('cursor', 'grabbing');
  else if (somethingIsHovered) canvas.style('cursor', 'grab');
  else canvas.style('cursor', 'default');

  // Faces
  for (let f of faces) { f.update(); f.display(); }
  // Topics (drawn after faces)
  for (let t of topics) { t.update(); t.display(); }

  // Retro speckles
  drawSpeckles();

  pop();
}

// --- UI Callbacks ---
function addTopic() {
  let text = select('#topic-input').value();
  if (text.trim() === '') return;
  topics.push(new Topic(text));
  select('#topic-input').value('');
}

function createParticleBurst(x, y) {
  for (let i = 0; i < PARTICLE_COUNT * 1.5; i++) {
    particles.push(new Particle(x, y));
  }
}

// Finds one unlinked face and one unlinked topic and links them.
function linkRandom() {
  let unlinkedFaces = faces.filter(f => !f.linkedTopic);
  let unlinkedTopics = topics.filter(t => !t.isLinked);

  if (unlinkedFaces.length > 0 && unlinkedTopics.length > 0) {
    let randomFace = unlinkedFaces[floor(random(unlinkedFaces.length))];
    let randomTopic = unlinkedTopics[floor(random(unlinkedTopics.length))];

    // Create two-way link
    randomFace.linkedTopic = randomTopic;
    randomTopic.isLinked = true;
    randomTopic.linkedFace = randomFace;

    randomFace.triggerGlitch();
    createParticleBurst(randomFace.pos.x, randomFace.pos.y);

    // Zap effect
    zaps.push({ from: randomFace.pos.copy(), to: randomTopic.pos.copy(), life: 20 });

    if (soundInitialized) {
      let randomNote = random(notes);
      osc.freq(randomNote);
      noiseEnv.play(noise);
      oscEnv.play(osc);
    }
  } else {
    triggerError();
  }
}

// Reset all links
function resetLinks() {
  for (let f of faces) f.linkedTopic = null;
  for (let t of topics) { t.isLinked = false; t.linkedFace = null; }
}

// Remove the last unlinked face and last unlinked topic
function removeLast() {
  for (let i = faces.length - 1; i >= 0; i--) {
    if (!faces[i].linkedTopic) { faces.splice(i, 1); break; }
  }
  for (let i = topics.length - 1; i >= 0; i--) {
    if (!topics[i].isLinked) { topics.splice(i, 1); break; }
  }
}

// Error / shake + sound
function triggerError() {
  shakeAmount = 10;
  if (soundInitialized) oscFailEnv.play(oscFail);
}

// Initialize sound on first click
function initSound() {
  if (typeof userStartAudio !== 'function') {
    console.error("p5.sound.js not loaded yet.");
    return false;
  }
  userStartAudio();

  try {
    // Link success sounds
    noise = new p5.Noise('white'); noise.amp(0); noise.start();
    noiseEnv = new p5.Env(); noiseEnv.setADSR(0.01, 0.1, 0, 0.1);

    osc = new p5.Oscillator('sine'); osc.amp(0); osc.start();
    oscEnv = new p5.Env(); oscEnv.setADSR(0.01, 0.2, 0.1, 0.3); oscEnv.setRange(0.5, 0);

    // Fail/error sound
    oscFail = new p5.Oscillator('sawtooth'); oscFail.freq(60); oscFail.amp(0); oscFail.start();
    oscFailEnv = new p5.Env(); oscFailEnv.setADSR(0.01, 0.05, 0, 0.05); oscFailEnv.setRange(0.3, 0);

    soundInitialized = true;
    return true;
  } catch (e) {
    console.error("Failed to initialize sound:", e);
    return false;
  }
}

// --- Mouse Interaction ---
function mousePressed() {
  // Init audio on first click
  if (!soundInitialized) { initSound(); return; }

  // Clicking a linked topic breaks the link
  for (let i = topics.length - 1; i >= 0; i--) {
    let t = topics[i];
    if (t.isLinked && t.isHovered) {
      if (t.linkedFace) t.linkedFace.linkedTopic = null;
      t.isLinked = false;
      t.linkedFace = null;
      return;
    }
  }

  // Start dragging (top-most first)
  if (!draggedObject) {
    for (let i = topics.length - 1; i >= 0; i--) if (topics[i].isHovered) { draggedObject = topics[i]; break; }
  }
  if (!draggedObject) {
    for (let i = faces.length - 1; i >= 0; i--) if (faces[i].isHovered) { draggedObject = faces[i]; break; }
  }
  if (draggedObject) {
    draggedObject.isDragging = true;
    draggedObject.dragOffset.set(draggedObject.pos.x - mouseX, draggedObject.pos.y - mouseY);
    canvas.style('cursor', 'grabbing');
  }
}

function mouseDragged() {
  if (draggedObject) draggedObject.pos.set(mouseX + draggedObject.dragOffset.x, mouseY + draggedObject.dragOffset.y);
}

function mouseReleased() {
  if (draggedObject) {
    draggedObject.isDragging = false;
    draggedObject = null;
    canvas.style('cursor', 'grab');
  }
}

// --- Retro Effects ---
function drawSpeckles() {
  stroke(255, 15);
  strokeWeight(1);
  for (let i = 0; i < 300; i++) point(random(width), random(height));
}

function drawStatic() {
  noStroke();
  for (let i = 0; i < 10; i++) {
    fill(random(0, 50), random(10, 30));
    rect(random(width), random(height), random(width / 2), random(height / 10));
  }
}

function drawZap(zap) {
  push();
  let alpha = map(zap.life, 0, 20, 0, 255);
  stroke(255, 255, 0, alpha);
  strokeWeight(3 + zap.life * 0.2);

  let mid = p5.Vector.lerp(zap.from, zap.to, 0.5);
  mid.add(p5.Vector.random2D().mult(zap.life * 1.5));

  noFill();
  beginShape();
  vertex(zap.from.x, zap.from.y);
  vertex(mid.x, mid.y);
  vertex(zap.to.x, zap.to.y);
  endShape();

  stroke(255, alpha);
  strokeWeight(1 + zap.life * 0.1);
  beginShape();
  vertex(zap.from.x, zap.from.y);
  vertex(mid.x, mid.y);
  vertex(zap.to.x, zap.to.y);
  endShape();
  pop();
}

// --- Base Classes ---
class BaseItem {
  constructor(x, y, r) {
    this.pos = createVector(x, y);
    this.radius = r;
    this.isDragging = false;
    this.dragOffset = createVector(0, 0);
    this.isHovered = false;
  }
  checkHover() {
    if (this.isDragging) { this.isHovered = false; return false; }
    let d = dist(mouseX, mouseY, this.pos.x, this.pos.y);
    this.isHovered = d < this.radius;
    return this.isHovered;
  }
  update() {}
}

// Face (Producer)
class Face extends BaseItem {
  constructor(img) {
    super(random(FACE_SIZE / 2, width - FACE_SIZE / 2), random(FACE_SIZE / 2, height / 2), FACE_SIZE / 2);
    this.img = img;
    this.img.filter(GRAY);
    this.linkedTopic = null;
    this.glitchAmount = 0;
  }
  triggerGlitch() { this.glitchAmount = 1.0; }
  update() {
    if (this.glitchAmount > 0) this.glitchAmount -= 0.05;
    else this.glitchAmount = 0;
  }
  display() {
    push();
    translate(this.pos.x, this.pos.y);
    imageMode(CENTER);

    if (this.isHovered && !this.isDragging) scale(1.05);

    if (this.glitchAmount > 0) {
      let gX = (random(-5, 5) * this.glitchAmount);
      let gY = (random(-5, 5) * this.glitchAmount);
      drawingContext.globalCompositeOperation = 'lighter';
      tint(255, 0, 0, 150 * this.glitchAmount); image(this.img, gX, gY, FACE_SIZE, FACE_SIZE);
      tint(0, 255, 0, 150 * this.glitchAmount); image(this.img, -gX, -gY, FACE_SIZE, FACE_SIZE);
      tint(0, 0, 255, 150 * this.glitchAmount); image(this.img, gX / 2, gY / 2, FACE_SIZE, FACE_SIZE);
      drawingContext.globalCompositeOperation = 'source-over';
      noTint();
    }

    if (this.glitchAmount > 0) tint(255, 255 * (1 - this.glitchAmount * 0.5));
    image(this.img, 0, 0, FACE_SIZE, FACE_SIZE);
    noTint();

    noFill();
    if (this.isHovered) { stroke(0, 255, 0); strokeWeight(3); }
    else { stroke(255); strokeWeight(2); }
    rect(0, 0, FACE_SIZE + 2, FACE_SIZE + 2, 8);
    pop();
  }
}

// Topic (Vibe/Genre)
class Topic extends BaseItem {
  constructor(text) {
    let tempWidth = textWidth(text) + 30;
    super(random(tempWidth / 2, width - tempWidth / 2), random(height / 2, height - TOPIC_HEIGHT / 2), Math.max(tempWidth / 2, TOPIC_HEIGHT / 2));
    this.text = text;
    this.width = tempWidth;
    this.height = TOPIC_HEIGHT;
    this.isLinked = false;
    this.linkedFace = null;
    this.pulse = random(1.0);
    this.pulseDir = 1;
  }
  update() {
    if (this.isLinked && this.linkedFace) {
      let targetY = this.linkedFace.pos.y - this.linkedFace.radius - (this.height / 2) - 10;
      if (targetY < this.height / 2) targetY = this.height / 2;
      this.pos.x = this.linkedFace.pos.x;
      this.pos.y = targetY;

      this.pulse += this.pulseDir * 0.05;
      if (this.pulse > 1.0 || this.pulse < 0) { this.pulseDir *= -1; this.pulse = constrain(this.pulse, 0, 1.0); }
    }
  }
  display() {
    push();
    translate(this.pos.x, this.pos.y);
    if (this.isHovered && !this.isDragging) scale(1.05);

    if (this.isHovered) { stroke(0, 255, 0); strokeWeight(3); }
    else { stroke(255); strokeWeight(1); }

    if (this.isLinked) {
      let easedPulse = 0.5 * (1.0 - cos(this.pulse * PI));
      let glowAlpha = 50 + (easedPulse * 100);
      noStroke();
      fill(255, glowAlpha);
      rect(0, 0, this.width + 5, this.height + 5, 8);

      if (this.isHovered) { stroke(0, 255, 0); strokeWeight(3); }
      else { stroke(255); strokeWeight(1); }

      fill(255);
      rect(0, 0, this.width, this.height, 5);
      noStroke();
      fill(0);
      text(this.text, 0, 0);
    } else {
      fill(0);
      rect(0, 0, this.width, this.height, 5);
      noStroke();
      fill(255);
      text(this.text, 0, 0);
    }
    pop();
  }
}

// Particle for link effect
class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(2, 6));
    this.lifespan = random(150, 255);
    this.decay = random(3, 6);
  }
  update() { this.pos.add(this.vel); this.vel.mult(0.98); this.lifespan -= this.decay; }
  isDead() { return this.lifespan < 0; }
  display() {
    let flicker = random(100, 255);
    noStroke();
    fill(flicker, this.lifespan);
    rect(this.pos.x, this.pos.y, 4, 4);
  }
}
