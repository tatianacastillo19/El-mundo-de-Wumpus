import { GridWorld } from './models/GridWorld.js';
import { Agent } from './agent/Agent.js';

console.log('=== TEST 1: MAPA CLÁSICO RUSSELL & NORVIG ===');
const world1 = new GridWorld(4, 4);
world1.loadPresetClassic();
const agent1 = new Agent(1, 1, 4, 4);

let steps = 0;
while (agent1.isAlive && !agent1.hasClimbed && agent1.status !== 'VICTORIA' && steps < 30) {
    const step = agent1.executeStep(world1);
    steps++;
    console.log(`\n--- PASO ${steps} en (${step.positionBefore.x}, ${step.positionBefore.y}) ---`);
    console.log(`Percepciones: ${step.perception.toString()}`);
    console.log(`Deducciones (${step.inference.deductions.length}):`);
    step.inference.deductions.forEach(d => console.log(`  > ${d}`));
    console.log(`Decisión: ${step.decision.action} -> ${step.decision.rationale}`);
    console.log(`Resultado: ${step.actionResult.message}`);
}

console.log(`\nESTADO FINAL CLÁSICO: ${agent1.status}, Puntaje: ${agent1.score}, Pasos: ${steps}`);

console.log('\n=== TEST 2: MAPA INTERSECCIÓN DE HEDOR ===');
const world2 = new GridWorld(4, 4);
world2.loadPresetStenchIntersection();
const agent2 = new Agent(1, 1, 4, 4);

steps = 0;
while (agent2.isAlive && !agent2.hasClimbed && agent2.status !== 'VICTORIA' && steps < 30) {
    const step = agent2.executeStep(world2);
    steps++;
    console.log(`[Paso ${steps}] (${step.positionBefore.x}, ${step.positionBefore.y}) | Acción: ${step.decision.action}`);
}
console.log(`ESTADO FINAL INTERSECCIÓN: ${agent2.status}, Puntaje: ${agent2.score}`);
