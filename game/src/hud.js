// The HUD: DOM panels for health, money, wanted stars, clock and tide, a
// canvas minimap, objective and dialogue boxes, and the title/pause/failed
// screens. Styled in style.css (dark glass, amber accent).
import { ROADS } from './config.js';

function el(id) {
  return document.getElementById(id);
}

function worldToMap(x, z) {
  return { x: 100 + x * 0.19, y: 100 + (z - 170) * 0.19 };
}

export function createHud(game) {
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  let dialogueTimer = 0;
  let dialogueFull = '';
  let dialogueShown = 0;
  let toastTimer = 0;
  let wantedFlashTimer = 0;

  const hud = {
    update(dt) {
      const p = game.player;
      const police = game.police;
      el('health-fill').style.width = `${Math.max(0, p.health)}%`;
      el('health-fill').style.background = p.health > 50 ? '#2ecc71' : p.health > 25 ? '#f39c12' : '#e74c3c';
      el('armor-fill').style.width = `${Math.max(0, p.armor)}%`;
      el('money').textContent = `$${Math.floor(p.money).toLocaleString('en-US')}`;
      el('shells').textContent = `🐚 ${game.stats.shells}/${game.shellTotal || 12}`;
      // Stars.
      const stars = el('stars').children;
      for (let i = 0; i < stars.length; i += 1) {
        stars[i].classList.toggle('lit', i < police.stars);
      }
      if (wantedFlashTimer > 0) {
        wantedFlashTimer -= dt;
        el('stars').classList.toggle('flash', Math.floor(wantedFlashTimer * 6) % 2 === 0);
      } else {
        el('stars').classList.remove('flash');
      }
      // Clock: the game day runs DAY_LENGTH seconds.
      const mins = Math.floor((game.time.clock / 240) * 1440);
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      el('clock').textContent = `${hh}:${mm}`;
      el('daynight').textContent = game.time.nightFactor > 0.5 ? '🌙' : '☀️';
      // Tide gauge.
      const level = game.tide.level;
      el('tide-fill').style.width = `${Math.round(level * 100)}%`;
      el('tide-label').textContent = level < 0.45 ? `LOW TIDE ${game.tide.toNext}` : `HIGH TIDE ${game.tide.toNext}`;
      el('tide-label').classList.toggle('low', level < 0.45);
      // Speed and weapon.
      if (p.inCar) {
        el('speed').textContent = `${Math.round(Math.abs(p.inCar.speed) * 3.6)} km/h`;
        el('carname').textContent = p.inCar.type.toUpperCase();
      } else {
        el('speed').textContent = '';
        el('carname').textContent = '';
      }
      el('weapon-name').textContent = p.weapon === 'fists' ? 'FISTS' : 'P9 PISTOL';
      el('ammo').textContent = p.weapon === 'fists' ? '' : `${p.mag.pistol} / ${p.ammo.pistol}${p.reloading > 0 ? ' …' : ''}`;
      el('crosshair').style.display = p.weapon === 'pistol' && !p.inCar ? 'block' : 'none';
      // Mission timer.
      const c = game.missions.current;
      const j = game.missions.sideJob;
      const r = game.missions.race;
      const t = c ? c.timer : j ? j.timer : r ? r.timer : 0;
      el('mission-timer').textContent = t > 0 ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '';
      // Mission card: which job, which step, what next — only while a
      // story mission runs, so free roam stays clean.
      const mc = el('mission-card');
      if (c && c.def.steps[c.step]) {
        const idx = game.missions.list.indexOf(c.def) + 1;
        el('mission-name').textContent = `MISSION ${idx}/${game.missions.list.length} · ${c.def.title.toUpperCase()}`;
        el('mission-step').textContent = `STEP ${c.step + 1}/${c.def.steps.length} — ${c.def.steps[c.step].label}`;
        mc.classList.remove('hidden');
      } else {
        mc.classList.add('hidden');
      }
      // Dialogue typewriter.
      if (dialogueTimer > 0) {
        dialogueTimer -= dt;
        dialogueShown = Math.min(dialogueFull.length, dialogueShown + dt * 55);
        el('dialogue-text').textContent = dialogueFull.slice(0, Math.floor(dialogueShown));
        if (dialogueTimer <= 0) el('dialogue').classList.add('hidden');
      }
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) el('toast').classList.add('hidden');
      }
      // Busted progress ring (a thin bar under the stars).
      el('busted-fill').style.width = `${Math.min(100, (police.bustedTimer / 2.5) * 100)}%`;
      this.drawMinimap(mctx);
    },
    drawMinimap(ctx) {
      const W = 200;
      const H = 200;
      ctx.fillStyle = '#0e1420';
      ctx.fillRect(0, 0, W, H);
      // Water and sand.
      const waterY = worldToMap(0, 336).y;
      ctx.fillStyle = '#164e6b';
      ctx.fillRect(0, waterY, W, H - waterY);
      ctx.fillStyle = '#c9b183';
      ctx.fillRect(0, worldToMap(0, 294).y, W, waterY - worldToMap(0, 294).y);
      // Island.
      const isl = worldToMap(0, 610);
      ctx.fillStyle = '#c9b183';
      ctx.beginPath();
      ctx.arc(isl.x, isl.y, 10, 0, Math.PI * 2);
      ctx.fill();
      // Causeway.
      ctx.strokeStyle = '#b8b0a0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(worldToMap(0, 294).x, worldToMap(0, 294).y);
      ctx.lineTo(isl.x, isl.y);
      ctx.stroke();
      // Roads.
      ctx.strokeStyle = '#4a5058';
      ctx.lineWidth = 2;
      for (const r of ROADS) {
        const a = worldToMap(r, -294);
        const b = worldToMap(r, 294);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        const c = worldToMap(-294, r);
        const d = worldToMap(294, r);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();
      }
      // Street race route: a dashed line from the player through the
      // remaining checkpoints, so the route reads at a glance.
      const race = game.missions.race;
      if (race) {
        const route = [{ x: game.player.pos.x, z: game.player.pos.z }, ...race.cps.slice(race.idx)];
        ctx.strokeStyle = '#ff5a3c';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        route.forEach((pt, i) => {
          const m = worldToMap(pt.x, pt.z);
          if (i === 0) ctx.moveTo(m.x, m.y);
          else ctx.lineTo(m.x, m.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        for (const cp of race.cps.slice(race.idx)) {
          const m = worldToMap(cp.x, cp.z);
          ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Golden shells still to collect.
      for (const pk of game.pickups) {
        if (pk.type !== 'shell') continue;
        const s = worldToMap(pk.pos.x, pk.pos.z);
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Mission marker.
      const marker = game.missions.marker;
      if (marker) {
        const m = worldToMap(marker.x, marker.z);
        const pulse = 6 + Math.sin(game.time.elapsed * 5) * 2;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(m.x, m.y, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // Traffic and police dots.
      for (const car of game.cars) {
        const m = worldToMap(car.pos.x, car.pos.z);
        ctx.fillStyle = car.isPolice ? '#ff4444' : '#dfe6ee';
        ctx.beginPath();
        ctx.arc(m.x, m.y, car.isPolice ? 3.5 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Player arrow.
      const p = game.player;
      const pm = worldToMap(p.pos.x, p.pos.z);
      const ang = p.inCar ? p.inCar.angle : p.angle;
      ctx.save();
      ctx.translate(pm.x, pm.y);
      ctx.rotate(ang);
      ctx.fillStyle = '#ff5a3c';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // North tick.
      ctx.fillStyle = '#8b93a3';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('N', 8, 14);
    },
    setObjective(text) {
      el('objective').textContent = text;
    },
    setPrompt(text) {
      const p = el('prompt');
      p.textContent = text;
      p.classList.toggle('hidden', !text);
    },
    showDialogue(speaker, text) {
      el('dialogue-speaker').textContent = speaker;
      dialogueFull = text;
      dialogueShown = 0;
      dialogueTimer = Math.max(6, text.length / 14);
      el('dialogue-text').textContent = '';
      el('dialogue').classList.remove('hidden');
    },
    // Reveal the whole line at once (a staged screenshot must not catch the
    // typewriter mid-sentence).
    finishDialogue() {
      if (dialogueFull) {
        dialogueShown = dialogueFull.length;
        el('dialogue-text').textContent = dialogueFull;
      }
    },
    toast(text) {
      el('toast').textContent = text;
      el('toast').classList.remove('hidden');
      toastTimer = 2.8;
    },
    flashWanted() {
      wantedFlashTimer = 1.2;
    },
    damageFlash() {
      const v = el('vignette');
      v.style.opacity = '0.85';
      window.setTimeout(() => {
        v.style.opacity = '0';
      }, 120);
    },
    showFailed(reason) {
      el('failed-reason').textContent = reason;
      el('failed-screen').classList.remove('hidden');
    },
    hideFailed() {
      el('failed-screen').classList.add('hidden');
    },
    showScreen(name) {
      for (const s of ['title-screen', 'pause-screen', 'failed-screen', 'over-screen']) {
        el(s).classList.toggle('hidden', s !== `${name}-screen`);
      }
      el('hud').classList.toggle('hidden', name === 'title');
    },
  };
  return hud;
}
