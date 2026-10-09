import assert from 'node:assert/strict';
import { GridWorld } from './models/GridWorld.js';
import { Agent } from './agent/Agent.js';
import { Perception } from './logic/Perception.js';
import { KnowledgeBase, CellStatus } from './logic/KnowledgeBase.js';
import { InferenceEngine } from './logic/InferenceEngine.js';
import { Actions, DecisionMaker } from './logic/DecisionMaker.js';

const vectorPerception = new Perception({ stench: true, glitter: true, scream: true });
assert.deepEqual(vectorPerception.toVector(), [1, 0, 1, 0, 1]);

const shotWorld = new GridWorld(4, 4);
shotWorld.loadPresetWumpusAboveStart();
const shotAgent = new Agent(1, 1, 4, 4);
const turnStep = shotAgent.executeStep(shotWorld);
assert.equal(turnStep.decision.action, Actions.TURN_LEFT);
const shotStep = shotAgent.executeStep(shotWorld);
assert.equal(shotStep.decision.action, Actions.SHOOT);
assert.equal(shotStep.actionResult.shotResult.hit, true);
assert.equal(shotStep.perception.scream, true);
assert.equal(shotStep.score - turnStep.score, -10);
assert.equal(shotWorld.getPerception(4, 4).scream, false);
assert.equal(shotAgent.kb.wumpusDead, true);
assert.equal(shotAgent.kb.safeCells.has('1,2'), true);

const missKnowledge = new KnowledgeBase(4, 4);
missKnowledge.recordVisit(1, 1, new Perception({ stench: true }));
missKnowledge.setNoWumpus(2, 1);
const missInference = new InferenceEngine(missKnowledge);
missInference.infer(1, 1, new Perception({ stench: true }), {
    hit: false,
    path: [{ x: 2, y: 1 }]
});
assert.equal(missKnowledge.wumpusStatus.get('2,1'), CellStatus.NO);

const priorKnowledge = new KnowledgeBase(4, 4);
assert.ok(Math.abs(priorKnowledge.getPitProbability(2, 2) - 0.2) < 1e-10);

const retreatWorld = new GridWorld(4, 4);
retreatWorld.loadPresetRetreat();
assert.equal(retreatWorld.pits.has('1,2'), false);
assert.equal(retreatWorld.pits.has('2,1'), false);
const safeGoldPath = ['2,1', '3,1', '4,1', '4,2', '4,3'];
assert.ok(safeGoldPath.every(cell => !retreatWorld.pits.has(cell)));
assert.ok(safeGoldPath.every(cell => {
    const [x, y] = cell.split(',').map(Number);
    return retreatWorld.wumpusPos.x !== x || retreatWorld.wumpusPos.y !== y;
}));
const retreatAgent = new Agent(1, 1, 4, 4);
let retreatStep = null;
let retreatSteps = 0;
while (retreatAgent.isAlive && !retreatAgent.hasClimbed && retreatSteps < 20) {
    const step = retreatAgent.executeStep(retreatWorld);
    retreatSteps++;
    if (!retreatStep && step.decision.rationale.includes('Se retira hacia la salida')) {
        retreatStep = step;
    }
}
assert.ok(retreatStep);
assert.equal(retreatStep.decision.action, Actions.MOVE_LEFT);
assert.equal(`${retreatStep.positionBefore.x},${retreatStep.positionBefore.y}`, '3,1');
assert.match(retreatStep.decision.rationale, /56% de riesgo/);
assert.match(retreatStep.decision.rationale, /utilidad esperada/);
assert.equal(retreatAgent.history.at(-1).decision.action, Actions.CLIMB);
assert.equal(retreatAgent.status, 'SALIDA_EXITOSA');
assert.equal(retreatAgent.hasGold, false);

const riskBoundaryKnowledge = new KnowledgeBase(4, 4);
riskBoundaryKnowledge.recordVisit(1, 1, new Perception());
riskBoundaryKnowledge.pitStatus.set('1,2', CellStatus.POSSIBLE);
riskBoundaryKnowledge.setConfirmedPit(2, 1);
riskBoundaryKnowledge.setNoWumpus(1, 2);
riskBoundaryKnowledge.setNoWumpus(2, 1);
riskBoundaryKnowledge.getPitProbability = (x, y) => x === 1 && y === 2 ? 0.5 : 0;
const riskBoundaryDecision = new DecisionMaker(riskBoundaryKnowledge).decide({
    x: 1, y: 1, hasGold: false, hasArrow: false, score: 0
}, new Perception());
assert.equal(riskBoundaryDecision.action, Actions.MOVE_UP);

const excessiveRiskKnowledge = new KnowledgeBase(4, 4);
const breezyStart = new Perception({ breeze: true });
excessiveRiskKnowledge.recordVisit(1, 1, breezyStart);
excessiveRiskKnowledge.setNoWumpus(1, 2);
excessiveRiskKnowledge.setNoWumpus(2, 1);
const excessiveRiskDecision = new DecisionMaker(excessiveRiskKnowledge).decide({
    x: 1, y: 1, hasGold: false, hasArrow: false, orientation: 'DERECHA'
}, breezyStart);
assert.equal(excessiveRiskDecision.action, Actions.CLIMB);

const safeKnowledge = new KnowledgeBase(4, 4);
safeKnowledge.setNoPit(2, 1);
safeKnowledge.setNoWumpus(2, 1);
const safeDecision = new DecisionMaker(safeKnowledge).decide({
    x: 1, y: 1, hasGold: false, hasArrow: true, orientation: 'DERECHA'
}, new Perception());
assert.equal(safeDecision.action, Actions.MOVE_RIGHT);

const aimKnowledge = new KnowledgeBase(4, 4);
aimKnowledge.recordVisit(1, 1, new Perception({ stench: true }));
aimKnowledge.setNoWumpus(2, 1);
const aimDecisionMaker = new DecisionMaker(aimKnowledge);
const turnDecision = aimDecisionMaker.decide({
    x: 1, y: 1, hasGold: false, hasArrow: true, orientation: 'DERECHA'
}, new Perception({ stench: true }));
assert.equal(turnDecision.action, Actions.TURN_LEFT);
const shootDecision = aimDecisionMaker.decide({
    x: 1, y: 1, hasGold: false, hasArrow: true, orientation: 'ARRIBA'
}, new Perception({ stench: true }));
assert.equal(shootDecision.action, Actions.SHOOT);

const retreatKnowledge = new KnowledgeBase(4, 4);
retreatKnowledge.setConfirmedPit(1, 2);
retreatKnowledge.setConfirmedPit(2, 1);
const retreatDecision = new DecisionMaker(retreatKnowledge).decide({
    x: 1, y: 1, hasGold: false, hasArrow: false, orientation: 'DERECHA'
}, new Perception());
assert.equal(retreatDecision.action, Actions.CLIMB);

console.log('Pruebas focalizadas de percepción, disparo y decisión: OK');

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
